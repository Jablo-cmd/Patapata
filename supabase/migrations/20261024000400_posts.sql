-- Social feed: posts, post media, comments, reactions, reshares, mentions.
--
-- Audiences: 'public' = every signed-in Patapata member (there is no
-- anonymous browsing), 'friends' = accepted friends, 'only_me' = author only.

create type public.post_audience as enum ('public', 'friends', 'only_me');
create type public.content_status as enum ('active', 'removed');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (length(body) <= 5000),
  audience public.post_audience not null default 'friends',
  shared_post_id uuid references public.posts (id) on delete set null,
  status public.content_status not null default 'active',
  removed_reason text,
  client_request_id uuid,
  media_count smallint not null default 0 check (media_count between 0 and 6),
  like_count int not null default 0 check (like_count >= 0),
  comment_count int not null default 0 check (comment_count >= 0),
  share_count int not null default 0 check (share_count >= 0),
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, client_request_id)
);
create index posts_author_created_idx on public.posts (author_id, created_at desc, id desc);
create index posts_public_created_idx on public.posts (created_at desc, id desc)
  where status = 'active' and audience = 'public';
create index posts_shared_idx on public.posts (shared_post_id) where shared_post_id is not null;
create index posts_search_idx on public.posts using gin (to_tsvector('simple', body));
create trigger posts_touch before update on public.posts
  for each row execute function app.touch_updated_at();

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  width int check (width is null or width between 1 and 10000),
  height int check (height is null or height between 1 and 10000),
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index post_media_post_idx on public.post_media (post_id, position);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  status public.content_status not null default 'active',
  reply_count int not null default 0,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_post_created_idx on public.comments (post_id, created_at, id);
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;
create index comments_author_idx on public.comments (author_id);
create trigger comments_touch before update on public.comments
  for each row execute function app.touch_updated_at();

create type public.reaction_kind as enum ('like');

create table public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.reaction_kind not null default 'like',
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_reactions_user_idx on public.post_reactions (user_id);

alter table public.notifications
  add constraint notifications_post_fk foreign key (post_id) references public.posts (id) on delete cascade,
  add constraint notifications_comment_fk foreign key (comment_id) references public.comments (id) on delete cascade;

-- Storage objects that should be deleted by the cleanup worker
-- (supabase/functions/cleanup-storage). SQL cannot delete storage files.
create table app.storage_deletion_queue (
  id bigint generated always as identity primary key,
  bucket_id text not null,
  object_path text not null,
  queued_at timestamptz not null default now(),
  processed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Visibility
-- ---------------------------------------------------------------------------

create or replace function app.can_view_post_row(
  p_author uuid, p_audience public.post_audience, p_status public.content_status, p_viewer uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_viewer is not null and (
    p_viewer = p_author
    or app.is_staff(p_viewer)
    or (p_status = 'active'
        and app.is_active(p_author)
        and not app.is_blocked_between(p_author, p_viewer)
        and (p_audience = 'public'
             or (p_audience = 'friends' and app.are_friends(p_author, p_viewer))))
  );
$$;

create or replace function app.can_view_post(p_post uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select app.can_view_post_row(p.author_id, p.audience, p.status, p_viewer)
    from public.posts p where p.id = p_post
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- Mentions: "@username" in a post or comment notifies that member if they
-- are allowed to see the post. At most 10 mentions per item.
-- ---------------------------------------------------------------------------

create or replace function app.notify_mentions(p_body text, p_actor uuid, p_post uuid, p_comment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  for v_user in
    select p.id
    from (select distinct lower(m[1]) as uname
          from regexp_matches(coalesce(p_body, ''), '@([A-Za-z0-9_]{3,30})', 'g') as m
          limit 10) u
    join public.profiles p on p.username = u.uname::extensions.citext
  loop
    if app.can_view_post(p_post, v_user) then
      perform app.notify(v_user, p_actor, 'mention', p_post => p_post, p_comment => p_comment);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Posts: create through RPC (atomic with media), edit/delete directly.
-- ---------------------------------------------------------------------------

create or replace function public.create_post(
  p_body text,
  p_audience public.post_audience default 'friends',
  p_media jsonb default '[]',
  p_shared_post_id uuid default null,
  p_client_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active();
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_media_count int := coalesce(jsonb_array_length(p_media), 0);
  v_orig public.posts;
  v_item jsonb;
  v_pos int := 0;
  v_path text;
begin
  -- Idempotency: retries of the same request return the original post.
  if p_client_request_id is not null then
    select id into v_id from public.posts where author_id = v_uid and client_request_id = p_client_request_id;
    if found then
      return v_id;
    end if;
  end if;

  perform app.hit_rate_limit('post_burst', 5, 60);
  perform app.hit_rate_limit('post', 40, 3600);

  if length(v_body) > 5000 then
    raise exception 'post_too_long' using errcode = '22023';
  end if;
  if v_media_count > 6 then
    raise exception 'too_many_images' using errcode = '22023';
  end if;
  if v_body = '' and v_media_count = 0 and p_shared_post_id is null then
    raise exception 'empty_post' using errcode = '22023';
  end if;

  -- Basic spam control: the same text twice within 10 minutes.
  if v_body <> '' and v_media_count = 0 and p_shared_post_id is null and exists (
    select 1 from public.posts
    where author_id = v_uid and body = v_body and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'duplicate_post' using errcode = '23505';
  end if;

  if p_shared_post_id is not null then
    select * into v_orig from public.posts where id = p_shared_post_id;
    if not found or not app.can_view_post_row(v_orig.author_id, v_orig.audience, v_orig.status, v_uid)
       or v_orig.status <> 'active' then
      raise exception 'post_not_found' using errcode = 'P0002';
    end if;
    -- Only public posts can be reshared, so a share never widens an audience.
    if v_orig.audience <> 'public' then
      raise exception 'post_not_shareable' using errcode = '42501';
    end if;
    -- Resharing a plain reshare points at the original.
    if v_orig.shared_post_id is not null and v_orig.body = '' and v_orig.media_count = 0 then
      select * into v_orig from public.posts where id = v_orig.shared_post_id;
    end if;
  end if;

  insert into public.posts (author_id, body, audience, shared_post_id, client_request_id, media_count)
  values (v_uid, v_body, coalesce(p_audience, 'friends'), v_orig.id, p_client_request_id, v_media_count)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_media, '[]')) loop
    v_path := v_item ->> 'path';
    if v_path is null or v_path !~ ('^' || v_uid::text || '/[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$') then
      raise exception 'invalid_media_path' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'post-media' and o.name = v_path) then
      raise exception 'media_not_uploaded' using errcode = '22023';
    end if;
    insert into public.post_media (post_id, owner_id, storage_path, width, height, position)
    values (v_id, v_uid, v_path,
            nullif(v_item ->> 'width', '')::int, nullif(v_item ->> 'height', '')::int, v_pos);
    v_pos := v_pos + 1;
  end loop;

  if v_orig.id is not null then
    update public.posts set share_count = share_count + 1 where id = v_orig.id;
    perform app.notify(v_orig.author_id, v_uid, 'post_share', p_post => v_id);
  end if;
  perform app.notify_mentions(v_body, v_uid, v_id, null);
  return v_id;
end;
$$;

create or replace function app.posts_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.body := btrim(new.body);
    if new.body = '' and new.media_count = 0 and new.shared_post_id is null then
      raise exception 'empty_post' using errcode = '22023';
    end if;
    new.edited_at := now();
  end if;
  return new;
end;
$$;
create trigger posts_before_update before update on public.posts
  for each row execute function app.posts_before_update();

create or replace function app.posts_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.shared_post_id is not null then
    update public.posts set share_count = greatest(share_count - 1, 0) where id = old.shared_post_id;
  end if;
  return old;
end;
$$;
create trigger posts_after_delete after delete on public.posts
  for each row execute function app.posts_after_delete();

create or replace function app.post_media_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into app.storage_deletion_queue (bucket_id, object_path) values ('post-media', old.storage_path);
  return old;
end;
$$;
create trigger post_media_after_delete after delete on public.post_media
  for each row execute function app.post_media_after_delete();

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

create or replace function app.comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.comments;
begin
  perform app.hit_rate_limit('comment_burst', 10, 60);
  perform app.hit_rate_limit('comment', 120, 3600);
  new.body := btrim(new.body);
  new.status := 'active';
  new.reply_count := 0;
  new.edited_at := null;
  if new.parent_id is not null then
    select * into v_parent from public.comments where id = new.parent_id;
    if not found or v_parent.post_id <> new.post_id then
      raise exception 'invalid_parent_comment' using errcode = '22023';
    end if;
    -- Replies are one level deep: replying to a reply attaches to its parent.
    if v_parent.parent_id is not null then
      new.parent_id := v_parent.parent_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger comments_before_insert before insert on public.comments
  for each row execute function app.comments_before_insert();

create or replace function app.comments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_author uuid;
  v_parent_author uuid;
begin
  update public.posts set comment_count = comment_count + 1 where id = new.post_id
  returning author_id into v_post_author;
  if new.parent_id is not null then
    update public.comments set reply_count = reply_count + 1 where id = new.parent_id
    returning author_id into v_parent_author;
    perform app.notify(v_parent_author, new.author_id, 'comment_reply', p_post => new.post_id, p_comment => new.id);
  end if;
  if v_post_author is distinct from v_parent_author then
    perform app.notify(v_post_author, new.author_id, 'post_comment', p_post => new.post_id, p_comment => new.id);
  end if;
  perform app.notify_mentions(new.body, new.author_id, new.post_id, new.id);
  return new;
end;
$$;
create trigger comments_after_insert after insert on public.comments
  for each row execute function app.comments_after_insert();

create or replace function app.comments_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  if old.parent_id is not null then
    update public.comments set reply_count = greatest(reply_count - 1, 0) where id = old.parent_id;
  end if;
  return old;
end;
$$;
create trigger comments_after_delete after delete on public.comments
  for each row execute function app.comments_after_delete();

create or replace function app.comments_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.body := btrim(new.body);
    new.edited_at := now();
  end if;
  return new;
end;
$$;
create trigger comments_before_update before update on public.comments
  for each row execute function app.comments_before_update();

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------

create or replace function app.reactions_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  if tg_op = 'INSERT' then
    perform app.hit_rate_limit('like', 600, 3600);
    update public.posts set like_count = like_count + 1 where id = new.post_id returning author_id into v_author;
    perform app.notify(v_author, new.user_id, 'post_like', p_post => new.post_id);
    return new;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    delete from public.notifications
    where type = 'post_like' and post_id = old.post_id and actor_id = old.user_id;
    return old;
  end if;
end;
$$;
create trigger reactions_after_change after insert or delete on public.post_reactions
  for each row execute function app.reactions_after_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.comments enable row level security;
alter table public.post_reactions enable row level security;

revoke all on public.posts, public.post_media, public.comments, public.post_reactions from anon, authenticated;

grant select (id, author_id, body, audience, shared_post_id, status, media_count, like_count,
  comment_count, share_count, edited_at, created_at) on public.posts to authenticated;
grant update (body, audience) on public.posts to authenticated;
grant delete on public.posts to authenticated;

create policy "view permitted posts" on public.posts
  for select to authenticated
  using (app.can_view_post_row(author_id, audience, status, (select auth.uid())));
create policy "authors edit active posts" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) and status = 'active' and app.is_active(author_id))
  with check (author_id = (select auth.uid()));
create policy "authors delete posts" on public.posts
  for delete to authenticated using (author_id = (select auth.uid()));

grant select on public.post_media to authenticated;
create policy "view media of permitted posts" on public.post_media
  for select to authenticated using (app.can_view_post(post_id, (select auth.uid())));

grant select (id, post_id, author_id, parent_id, body, status, reply_count, edited_at, created_at)
  on public.comments to authenticated;
grant insert (post_id, author_id, parent_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

create policy "view permitted comments" on public.comments
  for select to authenticated
  using (
    app.can_view_post(post_id, (select auth.uid()))
    and (author_id = (select auth.uid())
         or app.is_staff((select auth.uid()))
         or (status = 'active' and app.is_active(author_id)
             and not app.is_blocked_between(author_id, (select auth.uid()))))
  );
create policy "comment on permitted posts" on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and app.is_active(author_id)
    and app.can_view_post(post_id, author_id)
    and not app.is_blocked_between(author_id, (select p.author_id from public.posts p where p.id = post_id))
  );
create policy "authors edit comments" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()) and status = 'active')
  with check (author_id = (select auth.uid()));
create policy "authors or post owners delete comments" on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid())
         or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

grant select, delete on public.post_reactions to authenticated;
grant insert (post_id, user_id, kind) on public.post_reactions to authenticated;
create policy "view reactions on permitted posts" on public.post_reactions
  for select to authenticated
  using (app.can_view_post(post_id, (select auth.uid()))
         and not app.is_blocked_between(user_id, (select auth.uid())));
create policy "react to permitted posts" on public.post_reactions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and app.is_active(user_id)
              and app.can_view_post(post_id, user_id));
create policy "remove own reaction" on public.post_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Feed. SECURITY INVOKER: the RLS policies above are the single source of
-- truth for visibility; the query only narrows and paginates (keyset).
-- ---------------------------------------------------------------------------

create or replace function public.get_feed(
  p_scope text default 'home',          -- 'home' | 'explore' | 'user' | 'post' | 'search'
  p_user uuid default null,             -- for scope 'user'
  p_post uuid default null,             -- for scope 'post'
  p_country text default null,          -- optional filter for 'explore'
  p_query text default null,            -- for scope 'search'
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 20
)
returns table (
  id uuid,
  author_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_path text,
  author_country_code char(2),
  body text,
  audience public.post_audience,
  status public.content_status,
  media jsonb,
  like_count int,
  comment_count int,
  share_count int,
  liked_by_me boolean,
  shared_post jsonb,
  shared_post_id uuid,
  edited_at timestamptz,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select auth.uid() as uid),
  friend_ids as (
    select case when f.requester_id = me.uid then f.addressee_id else f.requester_id end as fid
    from public.friendships f, me
    where f.status = 'accepted' and me.uid in (f.requester_id, f.addressee_id)
  ),
  page as (
    select p.id, p.author_id, p.body, p.audience, p.status, p.shared_post_id, p.like_count,
           p.comment_count, p.share_count, p.edited_at, p.created_at
    from public.posts p, me
    where (
        (p_scope = 'home' and (p.author_id = me.uid or p.author_id in (select fid from friend_ids)))
        or (p_scope = 'explore' and p.audience = 'public' and p.status = 'active'
            and (p_country is null or exists (
                  select 1 from public.profiles ap where ap.id = p.author_id and ap.country_code = upper(p_country))))
        or (p_scope = 'user' and p.author_id = p_user)
        or (p_scope = 'post' and p.id = p_post)
        or (p_scope = 'search' and p.status = 'active' and length(btrim(coalesce(p_query, ''))) > 0
            and to_tsvector('simple', p.body) @@ websearch_to_tsquery('simple', p_query))
      )
      and (p_before is null or (p.created_at, p.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by p.created_at desc, p.id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
  )
  select
    p.id, p.author_id, a.username::text, a.display_name, a.avatar_path, a.country_code,
    p.body, p.audience, p.status,
    coalesce((select jsonb_agg(jsonb_build_object('path', m.storage_path, 'width', m.width, 'height', m.height)
                               order by m.position)
              from public.post_media m where m.post_id = p.id), '[]'::jsonb),
    p.like_count, p.comment_count, p.share_count,
    exists (select 1 from public.post_reactions r, me where r.post_id = p.id and r.user_id = me.uid),
    (select jsonb_build_object(
              'id', o.id, 'author_id', o.author_id, 'author_username', oa.username::text,
              'author_display_name', oa.display_name, 'author_avatar_path', oa.avatar_path,
              'body', o.body, 'created_at', o.created_at,
              'media', coalesce((select jsonb_agg(jsonb_build_object('path', om.storage_path, 'width', om.width,
                                                                     'height', om.height) order by om.position)
                                 from public.post_media om where om.post_id = o.id), '[]'::jsonb))
       from public.posts o join public.profiles oa on oa.id = o.author_id
       where o.id = p.shared_post_id),
    p.shared_post_id,
    p.edited_at, p.created_at
  from page p
  join public.profiles a on a.id = p.author_id
  order by p.created_at desc, p.id desc;
$$;
