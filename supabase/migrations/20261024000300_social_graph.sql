-- Social graph: blocks, friendships, notifications core, onboarding and
-- profile RPCs.

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create or replace function app.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------------------------------------------------------------------------
-- Friendships: one row per pair, regardless of who asked.
-- ---------------------------------------------------------------------------

create type public.friendship_status as enum ('pending', 'accepted');

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
-- Prevents duplicate requests in either direction.
create unique index friendships_pair_uidx on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_requester_idx on public.friendships (requester_id, status);
create index friendships_addressee_idx on public.friendships (addressee_id, status);

create or replace function app.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and least(requester_id, addressee_id) = least(a, b)
      and greatest(requester_id, addressee_id) = greatest(a, b)
  );
$$;

-- Whether `viewer` may see `target`'s profile card at all.
create or replace function app.profile_visible_to(target uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = viewer
      or app.is_staff(viewer)
      or (app.is_active(target) and not app.is_blocked_between(target, viewer));
$$;

-- Whether `viewer` may see `target`'s full profile content.
create or replace function app.profile_details_visible_to(target uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = viewer
      or app.is_staff(viewer)
      or (app.profile_visible_to(target, viewer)
          and (coalesce((select s.profile_visibility from public.user_privacy_settings s
                         where s.user_id = target), 'members') = 'members'
               or app.are_friends(target, viewer)));
$$;

create policy "profiles visible unless blocked or inactive" on public.profiles
  for select to authenticated
  using (app.profile_visible_to(id, (select auth.uid())));

alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select, insert, delete on public.blocks to authenticated;
create policy "see own blocks" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "block others" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "unblock" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;
-- All friendship writes go through RPCs below.
create policy "participants see their friendship rows" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- ---------------------------------------------------------------------------
-- Notifications core (FK constraints to content tables are added by later
-- migrations once those tables exist).
-- ---------------------------------------------------------------------------

create type public.notification_type as enum (
  'friend_request', 'friend_accepted', 'post_like', 'post_comment', 'comment_reply',
  'mention', 'post_share', 'message', 'meetup_response', 'meetup_update',
  'dating_match', 'security', 'moderation'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  post_id uuid,
  comment_id uuid,
  meetup_id uuid,
  conversation_id uuid,
  friendship_id uuid references public.friendships (id) on delete cascade,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function app.notification_allowed(p_user uuid, p_type public.notification_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_type in ('security', 'moderation') then true
    else coalesce((
      select case
        when p_type in ('friend_request', 'friend_accepted') then np.friend_requests
        when p_type in ('post_like', 'post_share') then np.likes
        when p_type in ('post_comment', 'comment_reply') then np.comments
        when p_type = 'mention' then np.mentions
        when p_type = 'message' then np.messages
        when p_type in ('meetup_response', 'meetup_update') then np.meetups
        when p_type = 'dating_match' then np.dating
        else true
      end
      from public.notification_preferences np where np.user_id = p_user
    ), true)
  end;
$$;

create or replace function app.notify(
  p_user uuid,
  p_actor uuid,
  p_type public.notification_type,
  p_post uuid default null,
  p_comment uuid default null,
  p_meetup uuid default null,
  p_conversation uuid default null,
  p_friendship uuid default null,
  p_data jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null or p_user = p_actor then
    return;
  end if;
  if p_actor is not null and app.is_blocked_between(p_user, p_actor) then
    return;
  end if;
  if not app.notification_allowed(p_user, p_type) then
    return;
  end if;
  insert into public.notifications
    (user_id, actor_id, type, post_id, comment_id, meetup_id, conversation_id, friendship_id, data)
  values
    (p_user, p_actor, p_type, p_post, p_comment, p_meetup, p_conversation, p_friendship, coalesce(p_data, '{}'));
end;
$$;

-- Blocking removes the friendship (and any pending request) and clears
-- notifications between the two people.
create or replace function app.on_block_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where least(requester_id, addressee_id) = least(new.blocker_id, new.blocked_id)
    and greatest(requester_id, addressee_id) = greatest(new.blocker_id, new.blocked_id);
  delete from public.notifications
  where (user_id = new.blocker_id and actor_id = new.blocked_id)
     or (user_id = new.blocked_id and actor_id = new.blocker_id);
  return new;
end;
$$;

create trigger blocks_after_insert after insert on public.blocks
  for each row execute function app.on_block_created();

create or replace function app.blocks_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.hit_rate_limit('block', 100, 86400);
  return new;
end;
$$;
create trigger blocks_rate_limit before insert on public.blocks
  for each row execute function app.blocks_rate_limit();

-- ---------------------------------------------------------------------------
-- Onboarding
-- ---------------------------------------------------------------------------

create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select lower(p_username) ~ '^[a-z0-9_]{3,30}$'
     and not exists (select 1 from app.reserved_usernames r where r.name = lower(p_username))
     and not exists (select 1 from public.profiles p where p.username = lower(p_username)::extensions.citext);
$$;

-- Returns 'ok', or 'age_ineligible' for members under 18. Other problems raise.
create or replace function public.complete_onboarding(
  p_username text,
  p_display_name text,
  p_birth_date date,
  p_country_code text,
  p_region text default null,
  p_city text default null,
  p_languages text[] default '{}',
  p_interests text[] default '{}',
  p_intents public.social_intent[] default '{friendship}',
  p_accept_terms boolean default false,
  p_terms_version text default '2026-10'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.account_status;
  v_confirmed boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform app.hit_rate_limit('onboarding', 20, 3600);

  select status into v_status from public.profiles where id = v_uid;
  if v_status is distinct from 'pending' then
    raise exception 'already_onboarded' using errcode = '22023';
  end if;

  select (u.email_confirmed_at is not null or u.phone_confirmed_at is not null)
    into v_confirmed from auth.users u where u.id = v_uid;
  if not coalesce(v_confirmed, false) then
    raise exception 'email_not_verified' using errcode = '42501';
  end if;

  if exists (select 1 from app.age_gate_failures where user_id = v_uid) then
    raise exception 'age_ineligible' using errcode = '42501',
      hint = 'Patapata is only for adults aged 18 and over.';
  end if;
  if p_birth_date is null or p_birth_date > (now() at time zone 'utc')::date
     or app.age_on(p_birth_date) > 120 then
    raise exception 'invalid_birth_date' using errcode = '22023';
  end if;
  if app.age_on(p_birth_date) < 18 then
    -- Returned rather than raised so that the failure record is committed and
    -- the same account cannot retry with a different date.
    insert into app.age_gate_failures (user_id) values (v_uid) on conflict do nothing;
    return 'age_ineligible';
  end if;

  if not coalesce(p_accept_terms, false) then
    raise exception 'terms_not_accepted' using errcode = '22023';
  end if;
  if not public.username_available(p_username) then
    raise exception 'username_unavailable' using errcode = '23505';
  end if;
  if not exists (select 1 from public.countries c where c.code = upper(p_country_code) and c.is_enabled) then
    raise exception 'invalid_country' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_display_name, ''))) = 0 then
    raise exception 'display_name_required' using errcode = '22023';
  end if;

  insert into public.profile_private (user_id, birth_date, accepted_terms_at, terms_version)
  values (v_uid, p_birth_date, now(), coalesce(p_terms_version, '2026-10'));

  update public.profiles set
    username = lower(p_username),
    display_name = left(p_display_name, 50),
    country_code = upper(p_country_code),
    region = p_region,
    city = p_city,
    languages = coalesce(p_languages, '{}'),
    interests = coalesce(p_interests, '{}'),
    intents = coalesce(p_intents, '{friendship}'),
    status = 'active',
    onboarded_at = now()
  where id = v_uid;
  return 'ok';
end;
$$;

create or replace function public.change_username(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active();
begin
  perform app.hit_rate_limit('change_username', 3, 86400);
  if not public.username_available(p_username) then
    raise exception 'username_unavailable' using errcode = '23505';
  end if;
  update public.profiles set username = lower(p_username) where id = v_uid;
end;
$$;

-- Stores a coarse (≈1 km) location for optional distance-based discovery.
create or replace function public.set_approximate_location(p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active();
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_coordinates' using errcode = '22023';
  end if;
  perform app.hit_rate_limit('set_location', 30, 3600);
  update public.profile_private
     set location = extensions.st_setsrid(
           extensions.st_makepoint(round(p_lng::numeric, 2)::float8, round(p_lat::numeric, 2)::float8), 4326
         )::extensions.geography,
         location_updated_at = now()
   where user_id = v_uid;
  update public.user_privacy_settings set location_enabled = true where user_id = v_uid;
end;
$$;

create or replace function public.clear_location()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.profile_private set location = null, location_updated_at = null where user_id = v_uid;
  update public.user_privacy_settings set location_enabled = false where user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Friend requests
-- ---------------------------------------------------------------------------

create or replace function public.send_friend_request(p_target uuid)
returns public.friendship_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active();
  v_existing public.friendships;
  v_id uuid;
begin
  if p_target = v_uid then
    raise exception 'cannot_friend_self' using errcode = '22023';
  end if;
  if not app.is_active(p_target) or app.is_blocked_between(v_uid, p_target) then
    raise exception 'user_unavailable' using errcode = '42501';
  end if;

  select * into v_existing from public.friendships
  where least(requester_id, addressee_id) = least(v_uid, p_target)
    and greatest(requester_id, addressee_id) = greatest(v_uid, p_target)
  for update;

  if found then
    if v_existing.status = 'accepted' then
      return 'accepted';
    elsif v_existing.requester_id = v_uid then
      return 'pending'; -- already requested; idempotent
    else
      -- They already asked us: sending a request back accepts it.
      update public.friendships set status = 'accepted', responded_at = now() where id = v_existing.id;
      perform app.notify(p_target, v_uid, 'friend_accepted', p_friendship => v_existing.id);
      return 'accepted';
    end if;
  end if;

  if (select friend_requests_from from public.user_privacy_settings where user_id = p_target) = 'nobody' then
    raise exception 'friend_requests_disabled' using errcode = '42501';
  end if;

  perform app.hit_rate_limit('friend_request', 50, 86400);
  insert into public.friendships (requester_id, addressee_id) values (v_uid, p_target)
  returning id into v_id;
  perform app.notify(p_target, v_uid, 'friend_request', p_friendship => v_id);
  return 'pending';
end;
$$;

create or replace function public.respond_friend_request(p_requester uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active();
  v_id uuid;
begin
  select id into v_id from public.friendships
  where requester_id = p_requester and addressee_id = v_uid and status = 'pending'
  for update;
  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now() where id = v_id;
    delete from public.notifications where friendship_id = v_id and type = 'friend_request';
    perform app.notify(p_requester, v_uid, 'friend_accepted', p_friendship => v_id);
  else
    delete from public.friendships where id = v_id;
  end if;
end;
$$;

create or replace function public.cancel_friend_request(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from public.friendships
  where requester_id = v_uid and addressee_id = p_target and status = 'pending';
end;
$$;

create or replace function public.remove_friend(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from public.friendships
  where status = 'accepted'
    and least(requester_id, addressee_id) = least(v_uid, p_target)
    and greatest(requester_id, addressee_id) = greatest(v_uid, p_target);
end;
$$;

-- Friends of a user, respecting that user's friends-list visibility.
create or replace function public.list_friends(p_user uuid, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, username text, display_name text, avatar_path text, country_code char(2), friends_since timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_vis public.list_visibility;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select friends_list_visibility into v_vis from public.user_privacy_settings where user_id = p_user;
  if not (p_user = v_uid or app.is_staff(v_uid)
          or (app.profile_visible_to(p_user, v_uid)
              and (v_vis = 'members' or (v_vis = 'friends' and app.are_friends(p_user, v_uid))))) then
    return;
  end if;
  return query
    select p.id, p.username::text, p.display_name, p.avatar_path, p.country_code, f.responded_at
    from public.friendships f
    join public.profiles p
      on p.id = case when f.requester_id = p_user then f.addressee_id else f.requester_id end
    where f.status = 'accepted' and p_user in (f.requester_id, f.addressee_id)
      and app.profile_visible_to(p.id, v_uid)
    order by f.responded_at desc nulls last, p.id
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;
