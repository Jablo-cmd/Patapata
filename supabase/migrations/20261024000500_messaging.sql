-- Private messaging: direct conversations between two members.
--
-- Only conversation members can read a conversation's messages; this is
-- enforced by RLS, so changing IDs in API requests does not expose other
-- people's messages. Messages are protected in transit (TLS) and at rest by
-- the hosting provider; they are NOT end-to-end encrypted.

create type public.conversation_kind as enum ('direct');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null default 'direct',
  direct_key text unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '' check (length(body) <= 4000),
  attachment_path text,
  client_request_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sender_id, client_request_id),
  check (deleted_at is not null or length(body) > 0 or attachment_path is not null)
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc, id desc);

alter table public.notifications
  add constraint notifications_conversation_fk foreign key (conversation_id)
    references public.conversations (id) on delete cascade;

create or replace function app.is_conversation_member(p_conversation uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation and m.user_id = p_user
  );
$$;

-- Whether `sender` may start or continue a direct conversation with
-- `recipient`. Redefined by the dating migration to also allow matches.
create or replace function app.can_message(p_sender uuid, p_recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_sender <> p_recipient
     and app.is_active(p_sender)
     and app.is_active(p_recipient)
     and not app.is_blocked_between(p_sender, p_recipient)
     and (
       case coalesce((select s.messages_from from public.user_privacy_settings s where s.user_id = p_recipient), 'friends')
         when 'everyone' then true
         when 'friends' then app.are_friends(p_sender, p_recipient)
         else false
       end
       -- The recipient already wrote to the sender in a direct conversation.
       or exists (
         select 1 from public.conversations c
         join public.messages m on m.conversation_id = c.id
         where c.direct_key = least(p_sender, p_recipient)::text || ':' || greatest(p_sender, p_recipient)::text
           and m.sender_id = p_recipient
       )
     );
$$;

create or replace function app.can_send_in_conversation(p_conversation uuid, p_sender uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_conversation_member(p_conversation, p_sender)
     and not exists (
       select 1 from public.conversation_members m
       where m.conversation_id = p_conversation and m.user_id <> p_sender
         and not app.can_message(p_sender, m.user_id)
     );
$$;

create or replace function public.get_or_create_direct_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active();
  v_key text := least(v_uid, p_other)::text || ':' || greatest(v_uid, p_other)::text;
  v_id uuid;
begin
  if p_other = v_uid then
    raise exception 'cannot_message_self' using errcode = '22023';
  end if;
  select id into v_id from public.conversations where direct_key = v_key;
  if found then
    return v_id;
  end if;
  if not app.can_message(v_uid, p_other) then
    raise exception 'messaging_not_allowed' using errcode = '42501',
      hint = 'This member only accepts messages from friends or matches.';
  end if;
  perform app.hit_rate_limit('new_conversation', 30, 86400);
  insert into public.conversations (kind, direct_key, created_by)
  values ('direct', v_key, v_uid)
  on conflict (direct_key) do update set direct_key = excluded.direct_key
  returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id)
  values (v_id, v_uid), (v_id, p_other)
  on conflict do nothing;
  return v_id;
end;
$$;

-- Coalesces message notifications: one unread notification per conversation.
create or replace function app.notify_message(p_recipient uuid, p_sender uuid, p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
     set created_at = now(), actor_id = p_sender,
         data = jsonb_build_object('count', coalesce((data ->> 'count')::int, 1) + 1)
   where user_id = p_recipient and type = 'message' and conversation_id = p_conversation and read_at is null;
  if not found then
    perform app.notify(p_recipient, p_sender, 'message', p_conversation => p_conversation,
                       p_data => jsonb_build_object('count', 1));
  end if;
end;
$$;

create or replace function app.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.hit_rate_limit('message_burst', 30, 60);
  perform app.hit_rate_limit('message', 600, 3600);
  new.body := btrim(coalesce(new.body, ''));
  new.deleted_at := null;
  new.created_at := clock_timestamp();
  if new.attachment_path is not null then
    if new.attachment_path !~ ('^' || new.conversation_id::text || '/' || new.sender_id::text
                               || '/[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$') then
      raise exception 'invalid_attachment_path' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects o
                   where o.bucket_id = 'message-media' and o.name = new.attachment_path) then
      raise exception 'attachment_not_uploaded' using errcode = '22023';
    end if;
  end if;
  if length(new.body) = 0 and new.attachment_path is null then
    raise exception 'empty_message' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function app.messages_before_insert();

create or replace function app.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  for v_member in
    select user_id from public.conversation_members
    where conversation_id = new.conversation_id and user_id <> new.sender_id
  loop
    perform app.notify_message(v_member, new.sender_id, new.conversation_id);
  end loop;
  return new;
end;
$$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function app.messages_after_insert();

create or replace function public.delete_message(p_message uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_path text;
begin
  select attachment_path into v_path from public.messages
   where id = p_message and sender_id = v_uid and deleted_at is null
   for update;
  if not found then
    raise exception 'message_not_found' using errcode = 'P0002';
  end if;
  update public.messages set deleted_at = now(), body = '', attachment_path = null where id = p_message;
  if v_path is not null then
    insert into app.storage_deletion_queue (bucket_id, object_path) values ('message-media', v_path);
  end if;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.conversation_members set last_read_at = clock_timestamp()
   where conversation_id = p_conversation and user_id = v_uid;
  update public.notifications set read_at = now()
   where user_id = v_uid and type = 'message' and conversation_id = p_conversation and read_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

revoke all on public.conversations, public.conversation_members, public.messages from anon, authenticated;
grant select (id, kind, created_at, last_message_at) on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;
grant select (id, conversation_id, sender_id, body, attachment_path, deleted_at, created_at)
  on public.messages to authenticated;
grant insert (conversation_id, sender_id, body, attachment_path, client_request_id)
  on public.messages to authenticated;

create policy "members see conversations" on public.conversations
  for select to authenticated using (app.is_conversation_member(id, (select auth.uid())));
create policy "members see co-members" on public.conversation_members
  for select to authenticated using (app.is_conversation_member(conversation_id, (select auth.uid())));
create policy "members read messages" on public.messages
  for select to authenticated using (app.is_conversation_member(conversation_id, (select auth.uid())));
create policy "members send permitted messages" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid())
              and app.is_active(sender_id)
              and app.can_send_in_conversation(conversation_id, sender_id));

-- Conversation list for the signed-in member.
create or replace function public.list_conversations(p_limit int default 30, p_before timestamptz default null)
returns table (
  id uuid,
  other_user_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_path text,
  last_message_body text,
  last_message_has_attachment boolean,
  last_message_sender_id uuid,
  last_message_at timestamptz,
  unread_count int,
  can_reply boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    om.user_id,
    op.username::text,
    op.display_name,
    op.avatar_path,
    case when lm.deleted_at is not null then null else left(lm.body, 140) end,
    lm.attachment_path is not null,
    lm.sender_id,
    c.last_message_at,
    (select count(*)::int from (
       select 1 from public.messages um
       where um.conversation_id = c.id and um.sender_id <> auth.uid() and um.created_at > me.last_read_at
       limit 99) u),
    app.can_send_in_conversation(c.id, auth.uid())
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join public.conversation_members om on om.conversation_id = c.id and om.user_id <> me.user_id
  left join public.profiles op on op.id = om.user_id
  left join lateral (
    select m.body, m.attachment_path, m.sender_id, m.deleted_at
    from public.messages m where m.conversation_id = c.id
    order by m.created_at desc, m.id desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and c.last_message_at is not null
    and (p_before is null or c.last_message_at < p_before)
  order by c.last_message_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
