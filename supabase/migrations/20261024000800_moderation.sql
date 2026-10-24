-- Safety & moderation: reports, moderation actions (audit log), appeals,
-- staff/admin RPCs, account deactivation & deletion, security notifications.

create type public.report_target as enum ('user', 'post', 'comment', 'message', 'meetup');
create type public.report_reason as enum (
  'spam', 'harassment', 'hate', 'violence_threat', 'sexual_content', 'child_safety', 'scam',
  'impersonation', 'self_harm', 'underage', 'privacy_violation', 'other'
);
create type public.report_priority as enum ('urgent', 'high', 'normal');
create type public.report_status as enum ('open', 'in_review', 'actioned', 'dismissed');
create type public.moderation_action_type as enum (
  'remove_content', 'restore_content', 'warn', 'suspend', 'ban', 'reinstate', 'dismiss_report',
  'grant_role', 'revoke_role'
);
create type public.appeal_status as enum ('open', 'upheld', 'overturned');

alter table public.profiles add column status_before_deactivation public.account_status;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type public.report_target not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  post_id uuid references public.posts (id) on delete set null,
  comment_id uuid references public.comments (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  meetup_id uuid references public.meetups (id) on delete set null,
  reason public.report_reason not null,
  details text not null default '' check (length(details) <= 1000),
  -- Snapshot of the reported content at report time. For messages this is the
  -- ONLY way moderators see private message content: just the reported item.
  evidence jsonb not null default '{}',
  priority public.report_priority not null,
  status public.report_status not null default 'open',
  assigned_to uuid references public.profiles (id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index reports_queue_idx on public.reports (status, priority, created_at);
create index reports_target_user_idx on public.reports (target_user_id);
create index reports_post_idx on public.reports (post_id) where post_id is not null;
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);
create trigger reports_touch before update on public.reports
  for each row execute function app.touch_updated_at();

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  action public.moderation_action_type not null,
  content_type public.report_target,
  content_id uuid,
  reason text not null check (length(reason) between 3 and 1000),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_user_id, created_at desc);
create index moderation_actions_created_idx on public.moderation_actions (created_at desc);

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  moderation_action_id uuid not null references public.moderation_actions (id) on delete cascade,
  message text not null check (length(message) between 10 and 2000),
  status public.appeal_status not null default 'open',
  reviewer_id uuid references public.profiles (id) on delete set null,
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (user_id, moderation_action_id)
);
create index appeals_status_idx on public.appeals (status, created_at);

alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.appeals enable row level security;
revoke all on public.reports, public.moderation_actions, public.appeals from anon, authenticated;

grant select (id, target_type, reason, status, created_at, resolved_at) on public.reports to authenticated;
create policy "reporters see their reports" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()) or app.is_staff((select auth.uid())));

grant select on public.moderation_actions to authenticated;
create policy "members see actions about them; staff see all" on public.moderation_actions
  for select to authenticated
  using (target_user_id = (select auth.uid()) or app.is_staff((select auth.uid())));

grant select on public.appeals to authenticated;
create policy "own appeals; staff see all" on public.appeals
  for select to authenticated
  using (user_id = (select auth.uid()) or app.is_staff((select auth.uid())));

-- ---------------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------------

create or replace function public.create_report(
  p_target_type public.report_target,
  p_target_id uuid,
  p_reason public.report_reason,
  p_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_target_user uuid;
  v_post uuid;
  v_comment uuid;
  v_message uuid;
  v_meetup uuid;
  v_evidence jsonb := '{}';
  v_priority public.report_priority;
  v_reporters int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform app.hit_rate_limit('report', 30, 86400);

  case p_target_type
    when 'user' then
      select id into v_target_user from public.profiles where id = p_target_id;
      if not found or p_target_id = v_uid then
        raise exception 'target_not_found' using errcode = 'P0002';
      end if;
      select jsonb_build_object('username', username, 'display_name', display_name, 'bio', bio,
                                'avatar_path', avatar_path)
        into v_evidence from public.profiles where id = p_target_id;
    when 'post' then
      if not app.can_view_post(p_target_id, v_uid) then
        raise exception 'target_not_found' using errcode = 'P0002';
      end if;
      select id, author_id, jsonb_build_object('body', body, 'audience', audience,
               'media', (select coalesce(jsonb_agg(storage_path), '[]') from public.post_media where post_id = p.id))
        into v_post, v_target_user, v_evidence from public.posts p where id = p_target_id;
    when 'comment' then
      select c.id, c.author_id, c.post_id, jsonb_build_object('body', c.body)
        into v_comment, v_target_user, v_post, v_evidence
        from public.comments c where c.id = p_target_id;
      if not found or not app.can_view_post(v_post, v_uid) then
        raise exception 'target_not_found' using errcode = 'P0002';
      end if;
    when 'message' then
      select m.id, m.sender_id, jsonb_build_object('body', m.body, 'attachment_path', m.attachment_path,
               'conversation_id', m.conversation_id, 'sent_at', m.created_at)
        into v_message, v_target_user, v_evidence
        from public.messages m
       where m.id = p_target_id and app.is_conversation_member(m.conversation_id, v_uid);
      if not found or v_target_user = v_uid then
        raise exception 'target_not_found' using errcode = 'P0002';
      end if;
    when 'meetup' then
      if not app.can_view_meetup(p_target_id, v_uid) then
        raise exception 'target_not_found' using errcode = 'P0002';
      end if;
      select id, host_id, jsonb_build_object('title', title, 'description', description, 'city', city,
               'venue_name', venue_name, 'starts_at', starts_at)
        into v_meetup, v_target_user, v_evidence from public.meetups where id = p_target_id;
  end case;

  -- One open report per reporter per item.
  select id into v_id from public.reports
   where reporter_id = v_uid and target_type = p_target_type and status in ('open', 'in_review')
     and case p_target_type
           when 'user' then target_user_id when 'post' then post_id when 'comment' then comment_id
           when 'message' then message_id when 'meetup' then meetup_id
         end = p_target_id;
  if found then
    return v_id;
  end if;

  v_priority := case
    when p_reason in ('child_safety', 'violence_threat', 'self_harm', 'underage') then 'urgent'
    when p_reason in ('harassment', 'hate', 'sexual_content', 'scam', 'impersonation', 'privacy_violation') then 'high'
    else 'normal'
  end::public.report_priority;

  insert into public.reports (reporter_id, target_type, target_user_id, post_id, comment_id, message_id,
                              meetup_id, reason, details, evidence, priority)
  values (v_uid, p_target_type, v_target_user,
          case when p_target_type in ('post', 'comment') then v_post end,
          v_comment, v_message, v_meetup, p_reason, left(btrim(coalesce(p_details, '')), 1000),
          v_evidence, v_priority)
  returning id into v_id;

  -- Automatic interim protection: hide a post reported by 5+ different
  -- members until a moderator reviews it.
  if p_target_type = 'post' then
    select count(distinct reporter_id) into v_reporters from public.reports
     where post_id = v_post and target_type = 'post' and status in ('open', 'in_review');
    if v_reporters >= 5 then
      update public.posts set status = 'removed', removed_reason = 'auto_hidden_pending_review'
       where id = v_post and status = 'active';
    end if;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Account lifecycle
-- ---------------------------------------------------------------------------

-- Hides the account immediately. With p_delete, the account and its content
-- are permanently erased after a 14-day grace period (see the
-- `purge-deleted-accounts` Edge Function).
create or replace function public.deactivate_account(p_delete boolean default false)
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
  update public.profiles
     set status_before_deactivation = case when status = 'deactivated' then status_before_deactivation else status end,
         status = 'deactivated',
         deletion_requested_at = case when p_delete then now() else null end
   where id = v_uid and status <> 'banned';
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.dating_preferences set enabled = false where user_id = v_uid;
end;
$$;

create or replace function public.reactivate_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.profiles
     set status = coalesce(status_before_deactivation, 'pending'),
         status_before_deactivation = null,
         deletion_requested_at = null
   where id = v_uid and status = 'deactivated';
  if not found then
    raise exception 'not_deactivated' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.my_account_state()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', p.status,
    'suspended_until', p.suspended_until,
    'deletion_requested_at', p.deletion_requested_at,
    'deletion_scheduled_for', p.deletion_requested_at + interval '14 days',
    'onboarded', p.onboarded_at is not null,
    'age_gate_failed', exists (select 1 from app.age_gate_failures f where f.user_id = p.id),
    'staff_role', (select s.role from public.staff_roles s where s.user_id = p.id),
    'email_verified', (select u.email_confirmed_at is not null from auth.users u where u.id = p.id)
  )
  from public.profiles p where p.id = auth.uid();
$$;

-- Used by the purge Edge Function (service role only).
create or replace function app.accounts_due_for_purge(p_limit int default 50)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles
  where status = 'deactivated' and deletion_requested_at < now() - interval '14 days'
  order by deletion_requested_at
  limit p_limit;
$$;

-- Security notifications for password and email changes.
create or replace function app.on_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;
  if new.encrypted_password is distinct from old.encrypted_password then
    perform app.notify(new.id, null, 'security', p_data => jsonb_build_object('event', 'password_changed'));
  end if;
  if new.email is distinct from old.email then
    perform app.notify(new.id, null, 'security', p_data => jsonb_build_object('event', 'email_changed'));
  end if;
  return new;
end;
$$;
create trigger on_auth_user_updated
  after update of encrypted_password, email on auth.users
  for each row execute function app.on_auth_user_updated();

-- ---------------------------------------------------------------------------
-- Appeals (allowed while suspended; banned members can also appeal)
-- ---------------------------------------------------------------------------

create or replace function public.submit_appeal(p_action uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform app.hit_rate_limit('appeal', 5, 86400);
  if not exists (
    select 1 from public.moderation_actions
    where id = p_action and target_user_id = v_uid
      and action in ('remove_content', 'warn', 'suspend', 'ban')
  ) then
    raise exception 'action_not_found' using errcode = 'P0002';
  end if;
  insert into public.appeals (user_id, moderation_action_id, message)
  values (v_uid, p_action, btrim(p_message))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff RPCs
-- ---------------------------------------------------------------------------

create or replace function app.require_staff(p_admin_only boolean default false)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not app.is_staff(v_uid) or (p_admin_only and not app.is_admin(v_uid)) then
    raise exception 'staff_only' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

create or replace function public.admin_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.require_staff();
  return jsonb_build_object(
    'members_total', (select count(*) from public.profiles where status = 'active'),
    'members_pending_onboarding', (select count(*) from public.profiles where status = 'pending'),
    'members_suspended', (select count(*) from public.profiles where status = 'suspended'),
    'members_banned', (select count(*) from public.profiles where status = 'banned'),
    'members_deactivated', (select count(*) from public.profiles where status = 'deactivated'),
    'signups_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'active_7d', (select count(*) from public.profiles where last_active_at > now() - interval '7 days'),
    'posts_24h', (select count(*) from public.posts where created_at > now() - interval '24 hours'),
    'comments_24h', (select count(*) from public.comments where created_at > now() - interval '24 hours'),
    'messages_24h', (select count(*) from public.messages where created_at > now() - interval '24 hours'),
    'meetups_upcoming', (select count(*) from public.meetups where status = 'scheduled'
                           and (starts_at is null or starts_at > now())),
    'dating_enabled', (select count(*) from public.dating_preferences where enabled),
    'reports_open', (select count(*) from public.reports where status in ('open', 'in_review')),
    'reports_urgent_open', (select count(*) from public.reports
                              where status in ('open', 'in_review') and priority = 'urgent'),
    'appeals_open', (select count(*) from public.appeals where status = 'open'),
    'rate_limit_hits_1h', (select count(*) from app.rate_limits
                             where window_start > now() - interval '1 hour' and hits > 50),
    'storage_cleanup_pending', (select count(*) from app.storage_deletion_queue where processed_at is null),
    'accounts_due_for_purge', (select count(*) from app.accounts_due_for_purge(1000)),
    'database_size_bytes', pg_database_size(current_database()),
    'members_by_country', (select coalesce(jsonb_object_agg(country_code, n), '{}') from (
        select country_code, count(*) n from public.profiles
        where status = 'active' and country_code is not null group by country_code order by n desc limit 20) c),
    'generated_at', now()
  );
end;
$$;

create or replace function public.admin_list_reports(
  p_status public.report_status default null,
  p_priority public.report_priority default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid, target_type public.report_target, reason public.report_reason, priority public.report_priority,
  status public.report_status, details text, reporter_id uuid, reporter_username text,
  target_user_id uuid, target_username text, target_status public.account_status,
  reports_against_target bigint, assigned_to uuid, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_staff();
  return query
    select r.id, r.target_type, r.reason, r.priority, r.status, r.details,
           r.reporter_id, rp.username::text, r.target_user_id, tp.username::text, tp.status,
           (select count(*) from public.reports r2 where r2.target_user_id = r.target_user_id),
           r.assigned_to, r.created_at
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles tp on tp.id = r.target_user_id
    where (p_status is null and r.status in ('open', 'in_review') or r.status = p_status)
      and (p_priority is null or r.priority = p_priority)
    order by case r.priority when 'urgent' then 0 when 'high' then 1 else 2 end, r.created_at
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;

create or replace function public.admin_get_report(p_report uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_r public.reports;
begin
  perform app.require_staff();
  select * into v_r from public.reports where id = p_report;
  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'report', to_jsonb(v_r),
    'reporter', (select jsonb_build_object('id', id, 'username', username, 'display_name', display_name)
                 from public.profiles where id = v_r.reporter_id),
    'target_user', (select jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name,
                       'status', p.status, 'suspended_until', p.suspended_until, 'created_at', p.created_at,
                       'avatar_path', p.avatar_path)
                    from public.profiles p where p.id = v_r.target_user_id),
    'current_content', case v_r.target_type
      when 'post' then (select jsonb_build_object('id', id, 'body', body, 'status', status, 'audience', audience,
                          'removed_reason', removed_reason) from public.posts where id = v_r.post_id)
      when 'comment' then (select jsonb_build_object('id', id, 'body', body, 'status', status)
                           from public.comments where id = v_r.comment_id)
      when 'meetup' then (select jsonb_build_object('id', id, 'title', title, 'status', status)
                          from public.meetups where id = v_r.meetup_id)
      else null end,
    'previous_actions', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]')
                         from public.moderation_actions a where a.target_user_id = v_r.target_user_id),
    'related_reports', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'reason', reason, 'status', status,
                          'created_at', created_at) order by created_at desc), '[]')
                        from public.reports where target_user_id = v_r.target_user_id and id <> v_r.id)
  );
end;
$$;

create or replace function public.admin_update_report(
  p_report uuid, p_status public.report_status, p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff uuid := app.require_staff();
begin
  update public.reports
     set status = p_status,
         resolution_note = coalesce(p_note, resolution_note),
         assigned_to = coalesce(assigned_to, v_staff),
         resolved_at = case when p_status in ('actioned', 'dismissed') then now() else null end
   where id = p_report;
  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
  if p_status = 'dismissed' then
    insert into public.moderation_actions (moderator_id, report_id, action, reason)
    values (v_staff, p_report, 'dismiss_report', coalesce(nullif(btrim(p_note), ''), 'No violation found'));
  end if;
end;
$$;

-- Remove or restore a post, comment or meetup.
create or replace function public.admin_moderate_content(
  p_content_type public.report_target,
  p_content_id uuid,
  p_remove boolean,
  p_reason text,
  p_report uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff uuid := app.require_staff();
  v_owner uuid;
  v_action uuid;
begin
  if p_content_type = 'post' then
    update public.posts
       set status = case when p_remove then 'removed' else 'active' end::public.content_status,
           removed_reason = case when p_remove then p_reason else null end
     where id = p_content_id returning author_id into v_owner;
  elsif p_content_type = 'comment' then
    update public.comments set status = case when p_remove then 'removed' else 'active' end::public.content_status
     where id = p_content_id returning author_id into v_owner;
  elsif p_content_type = 'meetup' then
    update public.meetups set status = case when p_remove then 'removed' else 'scheduled' end::public.meetup_status
     where id = p_content_id returning host_id into v_owner;
  else
    raise exception 'unsupported_content_type' using errcode = '22023';
  end if;
  if v_owner is null then
    raise exception 'content_not_found' using errcode = 'P0002';
  end if;

  insert into public.moderation_actions (moderator_id, report_id, target_user_id, action, content_type, content_id, reason)
  values (v_staff, p_report, v_owner,
          (case when p_remove then 'remove_content' else 'restore_content' end)::public.moderation_action_type,
          p_content_type, p_content_id, p_reason)
  returning id into v_action;

  if p_report is not null then
    update public.reports set status = 'actioned', resolved_at = now(), assigned_to = coalesce(assigned_to, v_staff),
           resolution_note = p_reason
     where id = p_report;
  end if;
  perform app.notify(v_owner, null, 'moderation',
    p_data => jsonb_build_object('action', case when p_remove then 'remove_content' else 'restore_content' end,
                                 'content_type', p_content_type, 'moderation_action_id', v_action, 'reason', p_reason));
  return v_action;
end;
$$;

create or replace function public.admin_set_account_status(
  p_user uuid,
  p_status public.account_status,
  p_reason text,
  p_until timestamptz default null,
  p_report uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff uuid := app.require_staff();
  v_action public.moderation_action_type;
  v_id uuid;
begin
  if p_user = v_staff then
    raise exception 'cannot_moderate_self' using errcode = '42501';
  end if;
  if app.is_staff(p_user) and not app.is_admin(v_staff) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_status = 'banned' and not app.is_admin(v_staff) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  v_action := case p_status
    when 'suspended' then 'suspend' when 'banned' then 'ban' when 'active' then 'reinstate'
    else null end;
  if v_action is null then
    raise exception 'unsupported_status' using errcode = '22023';
  end if;
  if p_status = 'suspended' and (p_until is null or p_until <= now()) then
    raise exception 'suspension_needs_end_date' using errcode = '22023';
  end if;

  update public.profiles
     set status = p_status,
         suspended_until = case when p_status = 'suspended' then p_until else null end
   where id = p_user and onboarded_at is not null;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if p_status in ('suspended', 'banned') then
    update public.dating_preferences set paused = true where user_id = p_user;
  end if;

  insert into public.moderation_actions (moderator_id, report_id, target_user_id, action, reason, expires_at)
  values (v_staff, p_report, p_user, v_action, p_reason, p_until)
  returning id into v_id;
  if p_report is not null then
    update public.reports set status = 'actioned', resolved_at = now(), assigned_to = coalesce(assigned_to, v_staff),
           resolution_note = p_reason
     where id = p_report;
  end if;
  perform app.notify(p_user, null, 'moderation',
    p_data => jsonb_build_object('action', v_action, 'until', p_until, 'moderation_action_id', v_id, 'reason', p_reason));
  return v_id;
end;
$$;

create or replace function public.admin_warn_user(p_user uuid, p_reason text, p_report uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff uuid := app.require_staff();
  v_id uuid;
begin
  insert into public.moderation_actions (moderator_id, report_id, target_user_id, action, reason)
  values (v_staff, p_report, p_user, 'warn', p_reason) returning id into v_id;
  if p_report is not null then
    update public.reports set status = 'actioned', resolved_at = now(), resolution_note = p_reason where id = p_report;
  end if;
  perform app.notify(p_user, null, 'moderation',
    p_data => jsonb_build_object('action', 'warn', 'moderation_action_id', v_id, 'reason', p_reason));
  return v_id;
end;
$$;

create or replace function public.admin_list_appeals(p_status public.appeal_status default 'open')
returns table (
  id uuid, user_id uuid, username text, message text, status public.appeal_status, created_at timestamptz,
  action_id uuid, action public.moderation_action_type, action_reason text, content_type public.report_target,
  content_id uuid, action_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_staff();
  return query
    select a.id, a.user_id, p.username::text, a.message, a.status, a.created_at,
           m.id, m.action, m.reason, m.content_type, m.content_id, m.created_at
    from public.appeals a
    join public.moderation_actions m on m.id = a.moderation_action_id
    left join public.profiles p on p.id = a.user_id
    where a.status = coalesce(p_status, a.status)
    order by a.created_at
    limit 200;
end;
$$;

create or replace function public.admin_decide_appeal(p_appeal uuid, p_overturn boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff uuid := app.require_staff();
  v_a public.appeals;
  v_m public.moderation_actions;
begin
  select * into v_a from public.appeals where id = p_appeal and status = 'open' for update;
  if not found then
    raise exception 'appeal_not_found' using errcode = 'P0002';
  end if;
  select * into v_m from public.moderation_actions where id = v_a.moderation_action_id;
  -- The moderator who took the action should not decide its appeal.
  if v_m.moderator_id = v_staff and not app.is_admin(v_staff) then
    raise exception 'needs_independent_reviewer' using errcode = '42501';
  end if;

  update public.appeals
     set status = case when p_overturn then 'overturned' else 'upheld' end::public.appeal_status,
         reviewer_id = v_staff, decision_note = p_note, decided_at = now()
   where id = p_appeal;

  if p_overturn then
    if v_m.action = 'remove_content' then
      perform public.admin_moderate_content(v_m.content_type, v_m.content_id, false,
                                            'Appeal overturned: ' || coalesce(p_note, ''));
    elsif v_m.action in ('suspend', 'ban') then
      update public.profiles set status = 'active', suspended_until = null
       where id = v_a.user_id and status in ('suspended', 'banned');
      insert into public.moderation_actions (moderator_id, target_user_id, action, reason)
      values (v_staff, v_a.user_id, 'reinstate', 'Appeal overturned: ' || coalesce(p_note, ''));
    end if;
  end if;
  perform app.notify(v_a.user_id, null, 'moderation',
    p_data => jsonb_build_object('action', 'appeal_decided', 'overturned', p_overturn, 'note', p_note));
end;
$$;

create or replace function public.admin_search_users(p_query text, p_limit int default 25)
returns table (
  id uuid, username text, display_name text, email text, status public.account_status,
  suspended_until timestamptz, country_code char(2), created_at timestamptz, reports_against bigint,
  staff_role public.staff_role
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_staff uuid := app.require_staff();
  v_is_admin boolean := app.is_admin(v_staff);
begin
  return query
    select p.id, p.username::text, p.display_name,
           case when v_is_admin then u.email::text end,
           p.status, p.suspended_until, p.country_code, p.created_at,
           (select count(*) from public.reports r where r.target_user_id = p.id),
           s.role
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.staff_roles s on s.user_id = p.id
    where p_query is null or p_query = ''
       or p.username::text ilike '%' || p_query || '%'
       or p.display_name ilike '%' || p_query || '%'
       or (v_is_admin and u.email ilike '%' || p_query || '%')
       or p.id::text = p_query
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.admin_set_staff_role(p_user uuid, p_role public.staff_role default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := app.require_staff(true);
begin
  if p_user = v_admin then
    raise exception 'cannot_change_own_role' using errcode = '42501';
  end if;
  if p_role is null then
    delete from public.staff_roles where user_id = p_user;
    insert into public.moderation_actions (moderator_id, target_user_id, action, reason)
    values (v_admin, p_user, 'revoke_role', 'Staff role revoked');
  else
    insert into public.staff_roles (user_id, role, granted_by) values (p_user, p_role, v_admin)
    on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = now();
    insert into public.moderation_actions (moderator_id, target_user_id, action, reason)
    values (v_admin, p_user, 'grant_role', 'Granted role ' || p_role::text);
  end if;
end;
$$;
