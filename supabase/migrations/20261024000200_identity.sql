-- Identity: profiles, private profile data, privacy & notification settings,
-- staff roles, onboarding (18+ age gate) and profile RPCs.
--
-- Privacy model
--   * `profiles` holds the public "card" (username, display name, avatar,
--     country) plus profile content. Clients may only SELECT the card columns
--     directly (column-level grants); full profile content is returned by the
--     `get_profile` RPC, which applies the owner's privacy settings.
--   * `profile_private` holds the birth date and coarse location. Only the
--     owner can read it; other users only ever see a derived age (if the owner
--     allows it) and a distance band.

create type public.account_status as enum ('pending', 'active', 'suspended', 'banned', 'deactivated');
create type public.social_intent as enum ('friendship', 'socialising', 'networking', 'travel_buddies', 'meetups');
create type public.profile_visibility as enum ('members', 'friends');
create type public.list_visibility as enum ('members', 'friends', 'only_me');
create type public.friend_request_policy as enum ('everyone', 'nobody');
create type public.message_policy as enum ('everyone', 'friends', 'nobody');
create type public.staff_role as enum ('moderator', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext unique
    check (username::text ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null default ''
    check (length(display_name) <= 50),
  bio text not null default '' check (length(bio) <= 500),
  avatar_path text check (avatar_path is null or length(avatar_path) <= 300),
  cover_path text check (cover_path is null or length(cover_path) <= 300),
  country_code char(2) references public.countries (code),
  region text check (region is null or length(region) <= 80),
  city text check (city is null or length(city) <= 80),
  languages text[] not null default '{}'
    check (cardinality(languages) <= 12),
  interests text[] not null default '{}' check (cardinality(interests) <= 20),
  hobbies text[] not null default '{}' check (cardinality(hobbies) <= 20),
  intents public.social_intent[] not null default '{friendship}',
  status public.account_status not null default 'pending',
  suspended_until timestamptz,
  onboarded_at timestamptz,
  deletion_requested_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_country_idx on public.profiles (country_code) where status = 'active';
create index profiles_username_trgm_idx on public.profiles using gin ((username::text) extensions.gin_trgm_ops);
create index profiles_display_name_trgm_idx on public.profiles using gin (lower(display_name) extensions.gin_trgm_ops);
create index profiles_interests_idx on public.profiles using gin (interests);
create index profiles_languages_idx on public.profiles using gin (languages);
create index profiles_status_idx on public.profiles (status);

create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birth_date date not null,
  -- Coarse location only: coordinates are rounded to 2 decimal places
  -- (~1 km) before storage and are never returned to other users.
  location extensions.geography(point, 4326),
  location_updated_at timestamptz,
  accepted_terms_at timestamptz not null,
  terms_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profile_private_location_idx on public.profile_private using gist (location);
create trigger profile_private_touch before update on public.profile_private
  for each row execute function app.touch_updated_at();

create table public.user_privacy_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  profile_visibility public.profile_visibility not null default 'members',
  friends_list_visibility public.list_visibility not null default 'friends',
  show_age boolean not null default true,
  show_city boolean not null default true,
  discoverable boolean not null default true,
  friend_requests_from public.friend_request_policy not null default 'everyone',
  messages_from public.message_policy not null default 'friends',
  location_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger user_privacy_settings_touch before update on public.user_privacy_settings
  for each row execute function app.touch_updated_at();

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  friend_requests boolean not null default true,
  likes boolean not null default true,
  comments boolean not null default true,
  mentions boolean not null default true,
  messages boolean not null default true,
  meetups boolean not null default true,
  dating boolean not null default true,
  push_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_touch before update on public.notification_preferences
  for each row execute function app.touch_updated_at();

create table public.staff_roles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.staff_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now()
);

-- Age-gate failures are recorded without the submitted birth date so the
-- same account cannot simply retry with a different date.
create table app.age_gate_failures (
  user_id uuid primary key,
  failed_at timestamptz not null default now()
);

create table app.reserved_usernames (name text primary key);
insert into app.reserved_usernames (name) values
  ('admin'), ('administrator'), ('patapata'), ('support'), ('help'), ('moderator'), ('mod'),
  ('staff'), ('security'), ('safety'), ('root'), ('system'), ('official'), ('team'), ('api'),
  ('settings'), ('about'), ('privacy'), ('terms'), ('null'), ('undefined'), ('me');

-- ---------------------------------------------------------------------------
-- Permission helpers. SECURITY DEFINER so they can be used inside RLS policies
-- without recursive policy evaluation; they only return booleans.
-- ---------------------------------------------------------------------------

create or replace function app.is_active(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and (p.status = 'active'
           or (p.status = 'suspended' and p.suspended_until is not null and p.suspended_until <= now()))
  );
$$;

create or replace function app.is_staff(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_roles s where s.user_id = p_user);
$$;

create or replace function app.is_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_roles s where s.user_id = p_user and s.role = 'admin');
$$;

create or replace function app.require_active()
returns uuid
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
  if not app.is_active(v_uid) then
    raise exception 'account_not_active: complete onboarding or contact support' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Ages are computed against the current UTC date.
create or replace function app.age_on(p_birth date, p_on date default (now() at time zone 'utc')::date)
returns int
language sql
immutable
set search_path = ''
as $$
  select extract(year from age(p_on, p_birth))::int;
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile shell (status 'pending' until onboarding).
-- ---------------------------------------------------------------------------

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 50));
  insert into public.user_privacy_settings (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- Validates and normalises user-editable profile fields.
create or replace function app.profiles_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := btrim(regexp_replace(new.display_name, '\s+', ' ', 'g'));
  new.bio := btrim(new.bio);
  new.region := nullif(btrim(new.region), '');
  new.city := nullif(btrim(new.city), '');
  new.interests := app.normalize_tags(new.interests, 20);
  new.hobbies := app.normalize_tags(new.hobbies, 20);
  new.languages := coalesce((
    select array_agg(distinct l) from unnest(new.languages) l where l ~ '^[a-z]{2,3}$'
  ), '{}');
  -- Media paths must live in the owner's own folder.
  if new.avatar_path is not null and new.avatar_path not like new.id::text || '/%' then
    raise exception 'invalid_avatar_path' using errcode = '22023';
  end if;
  if new.cover_path is not null and new.cover_path not like new.id::text || '/%' then
    raise exception 'invalid_cover_path' using errcode = '22023';
  end if;
  if new.status = 'active' and length(new.display_name) = 0 then
    raise exception 'display_name_required' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_validate before insert or update on public.profiles
  for each row execute function app.profiles_validate();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.user_privacy_settings enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.staff_roles enable row level security;

-- Column-level privileges: only the profile card is directly selectable.
revoke all on public.profiles from anon, authenticated;
grant select (id, username, display_name, avatar_path, country_code, status, created_at)
  on public.profiles to authenticated;
grant update (display_name, bio, avatar_path, cover_path, country_code, region, city,
  languages, interests, hobbies, intents)
  on public.profiles to authenticated;

revoke all on public.profile_private from anon, authenticated;
grant select (user_id, birth_date, location_updated_at, accepted_terms_at, terms_version)
  on public.profile_private to authenticated;

revoke all on public.user_privacy_settings from anon, authenticated;
grant select on public.user_privacy_settings to authenticated;
grant update (profile_visibility, friends_list_visibility, show_age, show_city, discoverable,
  friend_requests_from, messages_from)
  on public.user_privacy_settings to authenticated;

revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant update (friend_requests, likes, comments, mentions, messages, meetups, dating, push_enabled)
  on public.notification_preferences to authenticated;

revoke all on public.staff_roles from anon, authenticated;
grant select on public.staff_roles to authenticated;

create policy "own private profile" on public.profile_private
  for select to authenticated using (user_id = (select auth.uid()));

create policy "own privacy settings" on public.user_privacy_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "update own privacy settings" on public.user_privacy_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own notification preferences" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "update own notification preferences" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "see own staff role or admins see all" on public.staff_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or app.is_admin((select auth.uid())));

create policy "update own profile when active" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and app.is_active(id))
  with check (id = (select auth.uid()));

-- The SELECT policy on profiles is created in the social-graph migration,
-- once blocks exist (blocked users must not see each other).
