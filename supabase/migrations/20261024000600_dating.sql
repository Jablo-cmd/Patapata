-- Optional dating mode.
--
--   * Strictly opt-in: nobody appears in dating unless they enabled it.
--   * Adults only: onboarding already requires 18+, and every dating write
--     and query re-checks age.
--   * Likes are private. Members are only told about a *mutual* match.
--   * Dating activity is hidden from ordinary profiles unless the member
--     chooses `show_on_profile`.
--   * A match only means two people are interested in talking. It never
--     implies consent to anything else.

create type public.dating_gender as enum ('woman', 'man', 'non_binary', 'other');
create type public.dating_goal as enum ('long_term', 'dating', 'friendship_first', 'not_sure');
create type public.dating_decision as enum ('like', 'pass');

create table public.dating_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  enabled boolean not null default false,
  paused boolean not null default false,
  opted_in_at timestamptz,
  gender public.dating_gender not null,
  interested_in public.dating_gender[] not null check (cardinality(interested_in) between 1 and 4),
  min_age int not null default 18 check (min_age >= 18),
  max_age int not null default 99 check (max_age <= 99),
  countries char(2)[] not null default '{}' check (cardinality(countries) <= 54),
  max_distance_km int check (max_distance_km is null or max_distance_km between 1 and 20000),
  goals public.dating_goal[] not null default '{not_sure}',
  headline text not null default '' check (length(headline) <= 80),
  about text not null default '' check (length(about) <= 500),
  show_on_profile boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_age <= max_age)
);
create index dating_preferences_enabled_idx on public.dating_preferences (user_id)
  where enabled and not paused;
create trigger dating_preferences_touch before update on public.dating_preferences
  for each row execute function app.touch_updated_at();

create table public.dating_swipes (
  actor_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  decision public.dating_decision not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, target_id),
  check (actor_id <> target_id)
);
create index dating_swipes_target_idx on public.dating_swipes (target_id, decision);

create table public.dating_matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
create index dating_matches_b_idx on public.dating_matches (user_b);

create or replace function app.is_adult(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select app.age_on(pp.birth_date) >= 18 from public.profile_private pp where pp.user_id = p_user), false);
$$;

create or replace function app.are_matched(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.dating_matches m where m.user_a = least(a, b) and m.user_b = greatest(a, b));
$$;

create or replace function app.distance_band(p_meters double precision)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_meters is null then null
    when p_meters < 5000 then 'Under 5 km'
    when p_meters < 10000 then '5–10 km'
    when p_meters < 25000 then '10–25 km'
    when p_meters < 50000 then '25–50 km'
    when p_meters < 100000 then '50–100 km'
    when p_meters < 500000 then '100–500 km'
    else 'Over 500 km'
  end;
$$;

-- Messaging is also allowed between matched members.
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
       or app.are_matched(p_sender, p_recipient)
       or exists (
         select 1 from public.conversations c
         join public.messages m on m.conversation_id = c.id
         where c.direct_key = least(p_sender, p_recipient)::text || ':' || greatest(p_sender, p_recipient)::text
           and m.sender_id = p_recipient
       )
     );
$$;

create or replace function app.dating_preferences_validate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_active(new.user_id) then
    raise exception 'account_not_active' using errcode = '42501';
  end if;
  if not app.is_adult(new.user_id) then
    raise exception 'dating_adults_only' using errcode = '42501';
  end if;
  new.headline := btrim(new.headline);
  new.about := btrim(new.about);
  select coalesce(array_agg(distinct upper(c)), '{}') into new.countries
  from unnest(new.countries) c
  where exists (select 1 from public.countries pc where pc.code = upper(c));
  if new.enabled and (tg_op = 'INSERT' or not old.enabled) then
    new.opted_in_at := now();
  end if;
  return new;
end;
$$;
create trigger dating_preferences_validate before insert or update on public.dating_preferences
  for each row execute function app.dating_preferences_validate();

-- Leaving dating entirely (deleting preferences) erases dating activity.
create or replace function app.on_dating_preferences_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.dating_swipes where actor_id = old.user_id or target_id = old.user_id;
  delete from public.dating_matches where old.user_id in (user_a, user_b);
  delete from public.notifications where user_id = old.user_id and type = 'dating_match';
  return old;
end;
$$;
create trigger dating_preferences_after_delete after delete on public.dating_preferences
  for each row execute function app.on_dating_preferences_deleted();

-- Blocking removes dating likes and matches between the two people.
create or replace function app.on_block_dating_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.dating_swipes
   where (actor_id = new.blocker_id and target_id = new.blocked_id)
      or (actor_id = new.blocked_id and target_id = new.blocker_id);
  delete from public.dating_matches
   where user_a = least(new.blocker_id, new.blocked_id) and user_b = greatest(new.blocker_id, new.blocked_id);
  -- A block is also a "pass" so the person never resurfaces in dating.
  insert into public.dating_swipes (actor_id, target_id, decision)
  values (new.blocker_id, new.blocked_id, 'pass') on conflict do nothing;
  return new;
end;
$$;
create trigger blocks_dating_cleanup after insert on public.blocks
  for each row execute function app.on_block_dating_cleanup();

-- Whether `viewer` and `candidate` are mutually compatible dating candidates.
create or replace function app.dating_compatible(viewer uuid, candidate uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.dating_preferences me
    join public.dating_preferences them on them.user_id = candidate
    join public.profiles mp on mp.id = me.user_id
    join public.profiles tp on tp.id = them.user_id
    join public.profile_private mpp on mpp.user_id = me.user_id
    join public.profile_private tpp on tpp.user_id = them.user_id
    where me.user_id = viewer
      and viewer <> candidate
      and me.enabled and not me.paused and them.enabled and not them.paused
      and app.is_active(viewer) and app.is_active(candidate)
      and app.age_on(mpp.birth_date) >= 18 and app.age_on(tpp.birth_date) >= 18
      and not app.is_blocked_between(viewer, candidate)
      and them.gender = any (me.interested_in) and me.gender = any (them.interested_in)
      and app.age_on(tpp.birth_date) between me.min_age and me.max_age
      and app.age_on(mpp.birth_date) between them.min_age and them.max_age
      and (cardinality(me.countries) = 0 or tp.country_code = any (me.countries))
      and (cardinality(them.countries) = 0 or mp.country_code = any (them.countries))
  );
$$;

create or replace function public.get_dating_candidates(p_limit int default 20)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_path text,
  age int,
  country_code char(2),
  city text,
  headline text,
  about text,
  interests text[],
  languages text[],
  goals public.dating_goal[],
  distance_band text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active();
  v_me public.dating_preferences;
  v_loc extensions.geography;
  v_interests text[];
begin
  select * into v_me from public.dating_preferences where dating_preferences.user_id = v_uid;
  if not found or not v_me.enabled then
    raise exception 'dating_not_enabled' using errcode = '42501';
  end if;
  if not app.is_adult(v_uid) then
    raise exception 'dating_adults_only' using errcode = '42501';
  end if;
  select pp.location into v_loc from public.profile_private pp
  join public.user_privacy_settings s on s.user_id = pp.user_id
  where pp.user_id = v_uid and s.location_enabled;
  select p.interests into v_interests from public.profiles p where p.id = v_uid;

  return query
    select p.id, p.username::text, p.display_name, p.avatar_path,
           app.age_on(pp.birth_date), p.country_code,
           case when s.show_city then p.city else null end,
           d.headline, d.about, p.interests, p.languages, d.goals,
           case when v_loc is not null and s.location_enabled and pp.location is not null
                then app.distance_band(extensions.st_distance(v_loc, pp.location)) end
    from public.dating_preferences d
    join public.profiles p on p.id = d.user_id
    join public.profile_private pp on pp.user_id = d.user_id
    join public.user_privacy_settings s on s.user_id = d.user_id
    where d.enabled and not d.paused
      and d.user_id <> v_uid
      and not exists (select 1 from public.dating_swipes sw where sw.actor_id = v_uid and sw.target_id = d.user_id)
      and not app.are_matched(v_uid, d.user_id)
      and app.dating_compatible(v_uid, d.user_id)
      and (v_me.max_distance_km is null or v_loc is null
           or (s.location_enabled and pp.location is not null
               and extensions.st_dwithin(v_loc, pp.location, v_me.max_distance_km * 1000.0)))
    order by cardinality(array(select unnest(p.interests) intersect select unnest(v_interests))) desc,
             p.last_active_at desc nulls last, d.opted_in_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- Records a like or pass. Returns true when the like created a mutual match.
create or replace function public.dating_respond(p_target uuid, p_decision public.dating_decision)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active();
  v_match uuid;
begin
  if not app.dating_compatible(v_uid, p_target) then
    raise exception 'dating_candidate_unavailable' using errcode = '42501';
  end if;
  perform app.hit_rate_limit('dating_' || p_decision::text, 500, 86400);
  insert into public.dating_swipes (actor_id, target_id, decision)
  values (v_uid, p_target, p_decision)
  on conflict (actor_id, target_id) do update set decision = excluded.decision, created_at = now();

  if p_decision = 'like' and exists (
    select 1 from public.dating_swipes
    where actor_id = p_target and target_id = v_uid and decision = 'like'
  ) then
    insert into public.dating_matches (user_a, user_b)
    values (least(v_uid, p_target), greatest(v_uid, p_target))
    on conflict do nothing
    returning id into v_match;
    if v_match is not null then
      perform app.notify(p_target, v_uid, 'dating_match', p_data => jsonb_build_object('match_id', v_match));
      perform app.notify(v_uid, p_target, 'dating_match', p_data => jsonb_build_object('match_id', v_match));
    end if;
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.dating_unmatch(p_other uuid)
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
  delete from public.dating_matches where user_a = least(v_uid, p_other) and user_b = greatest(v_uid, p_other);
  insert into public.dating_swipes (actor_id, target_id, decision) values (v_uid, p_other, 'pass')
  on conflict (actor_id, target_id) do update set decision = 'pass';
end;
$$;

create or replace function public.list_dating_matches()
returns table (
  match_id uuid, user_id uuid, username text, display_name text, avatar_path text, matched_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, p.id, p.username::text, p.display_name, p.avatar_path, m.created_at
  from public.dating_matches m
  join public.profiles p on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  where auth.uid() in (m.user_a, m.user_b)
    and app.profile_visible_to(p.id, auth.uid())
  order by m.created_at desc;
$$;

alter table public.dating_preferences enable row level security;
alter table public.dating_swipes enable row level security;
alter table public.dating_matches enable row level security;

revoke all on public.dating_preferences, public.dating_swipes, public.dating_matches from anon, authenticated;
grant select, delete on public.dating_preferences to authenticated;
grant insert (user_id, enabled, paused, gender, interested_in, min_age, max_age, countries, max_distance_km,
  goals, headline, about, show_on_profile) on public.dating_preferences to authenticated;
grant update (enabled, paused, gender, interested_in, min_age, max_age, countries, max_distance_km,
  goals, headline, about, show_on_profile) on public.dating_preferences to authenticated;
grant select on public.dating_swipes to authenticated;
grant select on public.dating_matches to authenticated;

create policy "own dating preferences" on public.dating_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "create own dating preferences" on public.dating_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "update own dating preferences" on public.dating_preferences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own dating preferences" on public.dating_preferences
  for delete to authenticated using (user_id = (select auth.uid()));
-- Only your own decisions are visible: other people's likes stay private.
create policy "own swipes" on public.dating_swipes
  for select to authenticated using (actor_id = (select auth.uid()));
create policy "own matches" on public.dating_matches
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));
