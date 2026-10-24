-- Chill posts and meetups.
--
--   * 'chill' = an open invitation ("Anyone up for coffee in Accra?"),
--     optionally without a time or venue. 'event' = a scheduled meetup.
--   * Venue details are optional, intended for public places, and by default
--     shown only to people who said they are going (`venue_visibility`).
--     Home addresses or coordinates are never derived or revealed.

create type public.meetup_kind as enum ('chill', 'event');
create type public.meetup_category as enum (
  'coffee', 'food', 'sport', 'football', 'music', 'culture', 'outdoors', 'study',
  'networking', 'travel', 'faith', 'other'
);
create type public.meetup_audience as enum ('public', 'friends');
create type public.meetup_status as enum ('scheduled', 'cancelled', 'removed');
create type public.venue_visibility as enum ('everyone', 'attendees');
create type public.meetup_response_status as enum ('going', 'interested', 'not_going');

create table public.meetups (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  kind public.meetup_kind not null default 'chill',
  title text not null check (length(title) between 3 and 120),
  description text not null default '' check (length(description) <= 2000),
  category public.meetup_category not null default 'other',
  country_code char(2) not null references public.countries (code),
  city text not null check (length(city) between 1 and 80),
  venue_name text check (venue_name is null or length(venue_name) <= 120),
  venue_address text check (venue_address is null or length(venue_address) <= 200),
  venue_visibility public.venue_visibility not null default 'attendees',
  starts_at timestamptz,
  ends_at timestamptz,
  capacity int check (capacity is null or capacity between 2 and 500),
  audience public.meetup_audience not null default 'public',
  status public.meetup_status not null default 'scheduled',
  going_count int not null default 0,
  interested_count int not null default 0,
  search tsvector generated always as (
    to_tsvector('simple', title || ' ' || description || ' ' || city)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'chill' or starts_at is not null),
  check (ends_at is null or (starts_at is not null and ends_at > starts_at))
);
create index meetups_country_city_idx on public.meetups (country_code, lower(city), starts_at)
  where status = 'scheduled';
create index meetups_host_idx on public.meetups (host_id, created_at desc);
create index meetups_search_idx on public.meetups using gin (search);
create trigger meetups_touch before update on public.meetups
  for each row execute function app.touch_updated_at();

create table public.meetup_responses (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.meetup_response_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
create index meetup_responses_user_idx on public.meetup_responses (user_id);
create trigger meetup_responses_touch before update on public.meetup_responses
  for each row execute function app.touch_updated_at();

alter table public.notifications
  add constraint notifications_meetup_fk foreign key (meetup_id) references public.meetups (id) on delete cascade;

create or replace function app.can_view_meetup_row(
  p_host uuid, p_audience public.meetup_audience, p_status public.meetup_status, p_viewer uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_viewer is not null and (
    p_viewer = p_host
    or app.is_staff(p_viewer)
    or (p_status <> 'removed'
        and app.is_active(p_host)
        and not app.is_blocked_between(p_host, p_viewer)
        and (p_audience = 'public' or app.are_friends(p_host, p_viewer)))
  );
$$;

create or replace function app.can_view_meetup(p_meetup uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select app.can_view_meetup_row(m.host_id, m.audience, m.status, p_viewer)
                   from public.meetups m where m.id = p_meetup), false);
$$;

create or replace function app.meetups_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.hit_rate_limit('meetup', 10, 86400);
    new.status := 'scheduled';
    new.going_count := 0;
    new.interested_count := 0;
    if new.starts_at is not null and new.starts_at < now() - interval '5 minutes' then
      raise exception 'meetup_in_past' using errcode = '22023';
    end if;
  else
    -- Hosts may cancel; only moderators (via SECURITY DEFINER RPCs) remove.
    if new.status = 'removed' and old.status <> 'removed' and not app.is_staff(auth.uid())
       and auth.uid() is not null then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;
  new.title := btrim(new.title);
  new.description := btrim(new.description);
  new.city := btrim(new.city);
  new.venue_name := nullif(btrim(new.venue_name), '');
  new.venue_address := nullif(btrim(new.venue_address), '');
  if new.starts_at is not null and new.starts_at > now() + interval '1 year' then
    raise exception 'meetup_too_far_ahead' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger meetups_validate before insert or update on public.meetups
  for each row execute function app.meetups_validate();

-- Host is automatically "going".
create or replace function app.meetups_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.meetup_responses (meetup_id, user_id, status) values (new.id, new.host_id, 'going');
  return new;
end;
$$;
create trigger meetups_after_insert after insert on public.meetups
  for each row execute function app.meetups_after_insert();

-- Tell attendees about cancellations and time/venue changes.
create or replace function app.meetups_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_change text;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    v_change := 'cancelled';
  elsif new.starts_at is distinct from old.starts_at
     or new.venue_name is distinct from old.venue_name
     or new.venue_address is distinct from old.venue_address then
    v_change := 'details_changed';
  else
    return new;
  end if;
  for v_user in
    select user_id from public.meetup_responses
    where meetup_id = new.id and status in ('going', 'interested') and user_id <> new.host_id
  loop
    perform app.notify(v_user, new.host_id, 'meetup_update', p_meetup => new.id,
                       p_data => jsonb_build_object('change', v_change));
  end loop;
  return new;
end;
$$;
create trigger meetups_after_update after update on public.meetups
  for each row execute function app.meetups_after_update();

create or replace function app.meetup_responses_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.meetup_id, old.meetup_id);
begin
  update public.meetups m set
    going_count = (select count(*) from public.meetup_responses r where r.meetup_id = v_id and r.status = 'going'),
    interested_count = (select count(*) from public.meetup_responses r where r.meetup_id = v_id and r.status = 'interested')
  where m.id = v_id;
  return null;
end;
$$;
create trigger meetup_responses_counts after insert or update or delete on public.meetup_responses
  for each row execute function app.meetup_responses_counts();

create or replace function public.respond_to_meetup(p_meetup uuid, p_status public.meetup_response_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active();
  v_m public.meetups;
  v_prev public.meetup_response_status;
begin
  select * into v_m from public.meetups where id = p_meetup for update;
  if not found or not app.can_view_meetup_row(v_m.host_id, v_m.audience, v_m.status, v_uid) then
    raise exception 'meetup_not_found' using errcode = 'P0002';
  end if;
  if v_m.host_id = v_uid then
    raise exception 'host_cannot_respond' using errcode = '22023';
  end if;
  if v_m.status <> 'scheduled' then
    raise exception 'meetup_not_open' using errcode = '22023';
  end if;
  if v_m.starts_at is not null and coalesce(v_m.ends_at, v_m.starts_at + interval '6 hours') < now() then
    raise exception 'meetup_finished' using errcode = '22023';
  end if;
  perform app.hit_rate_limit('meetup_response', 100, 3600);

  select status into v_prev from public.meetup_responses where meetup_id = p_meetup and user_id = v_uid;
  if p_status = 'going' and v_prev is distinct from 'going' and v_m.capacity is not null
     and v_m.going_count >= v_m.capacity then
    raise exception 'meetup_full' using errcode = '22023';
  end if;

  insert into public.meetup_responses (meetup_id, user_id, status) values (p_meetup, v_uid, p_status)
  on conflict (meetup_id, user_id) do update set status = excluded.status;

  if p_status in ('going', 'interested') and v_prev is distinct from p_status then
    perform app.notify(v_m.host_id, v_uid, 'meetup_response', p_meetup => p_meetup,
                       p_data => jsonb_build_object('status', p_status));
  end if;
end;
$$;

create or replace function public.leave_meetup(p_meetup uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.meetup_responses r
  using public.meetups m
  where r.meetup_id = p_meetup and r.user_id = auth.uid() and m.id = r.meetup_id and m.host_id <> auth.uid();
$$;

-- Meetups with venue details masked according to venue_visibility.
create or replace function public.list_meetups(
  p_meetup uuid default null,
  p_country text default null,
  p_city text default null,
  p_category public.meetup_category default null,
  p_host uuid default null,
  p_query text default null,
  p_include_past boolean default false,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid, host_id uuid, host_username text, host_display_name text, host_avatar_path text,
  kind public.meetup_kind, title text, description text, category public.meetup_category,
  country_code char(2), city text, venue_name text, venue_address text, venue_hidden boolean,
  venue_visibility public.venue_visibility, starts_at timestamptz, ends_at timestamptz, capacity int,
  audience public.meetup_audience, status public.meetup_status, going_count int, interested_count int,
  my_response public.meetup_response_status, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return query
    with rows as (
      select m.*, r.status as my_status,
             (m.host_id = v_uid or m.venue_visibility = 'everyone'
              or coalesce(r.status = 'going', false) or app.is_staff(v_uid)) as venue_ok
      from public.meetups m
      left join public.meetup_responses r on r.meetup_id = m.id and r.user_id = v_uid
      where app.can_view_meetup_row(m.host_id, m.audience, m.status, v_uid)
        and (p_meetup is null or m.id = p_meetup)
        and (p_country is null or m.country_code = upper(p_country))
        and (p_city is null or lower(m.city) = lower(btrim(p_city)))
        and (p_category is null or m.category = p_category)
        and (p_host is null or m.host_id = p_host)
        and (p_query is null or m.search @@ websearch_to_tsquery('simple', p_query))
        and (p_meetup is not null or p_include_past or m.status = 'scheduled')
        and (p_meetup is not null or p_include_past or m.starts_at is null
             or coalesce(m.ends_at, m.starts_at + interval '6 hours') >= now())
        and (p_meetup is not null or m.kind = 'event' or m.created_at > now() - interval '30 days'
             or p_include_past)
    )
    select x.id, x.host_id, h.username::text, h.display_name, h.avatar_path,
           x.kind, x.title, x.description, x.category, x.country_code, x.city,
           case when x.venue_ok then x.venue_name end,
           case when x.venue_ok then x.venue_address end,
           (not x.venue_ok and (x.venue_name is not null or x.venue_address is not null)),
           x.venue_visibility, x.starts_at, x.ends_at, x.capacity, x.audience, x.status,
           x.going_count, x.interested_count, x.my_status, x.created_at
    from rows x
    join public.profiles h on h.id = x.host_id
    order by (x.starts_at is null), x.starts_at asc nulls last, x.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

alter table public.meetups enable row level security;
alter table public.meetup_responses enable row level security;
revoke all on public.meetups, public.meetup_responses from anon, authenticated;

-- Venue columns are deliberately not selectable; use list_meetups().
grant select (id, host_id, kind, title, description, category, country_code, city, venue_visibility,
  starts_at, ends_at, capacity, audience, status, going_count, interested_count, created_at, updated_at)
  on public.meetups to authenticated;
grant insert (host_id, kind, title, description, category, country_code, city, venue_name, venue_address,
  venue_visibility, starts_at, ends_at, capacity, audience) on public.meetups to authenticated;
grant update (kind, title, description, category, city, venue_name, venue_address, venue_visibility,
  starts_at, ends_at, capacity, audience, status) on public.meetups to authenticated;
grant delete on public.meetups to authenticated;

create policy "view permitted meetups" on public.meetups
  for select to authenticated
  using (app.can_view_meetup_row(host_id, audience, status, (select auth.uid())));
create policy "active members host meetups" on public.meetups
  for insert to authenticated
  with check (host_id = (select auth.uid()) and app.is_active(host_id));
create policy "hosts edit meetups" on public.meetups
  for update to authenticated
  using (host_id = (select auth.uid()) and status <> 'removed')
  with check (host_id = (select auth.uid()) and status in ('scheduled', 'cancelled'));
create policy "hosts delete meetups" on public.meetups
  for delete to authenticated using (host_id = (select auth.uid()));

grant select on public.meetup_responses to authenticated;
create policy "see responses to permitted meetups" on public.meetup_responses
  for select to authenticated
  using (user_id = (select auth.uid())
         or (app.can_view_meetup(meetup_id, (select auth.uid()))
             and app.profile_visible_to(user_id, (select auth.uid()))));
