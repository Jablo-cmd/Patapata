-- Profiles, discovery across Africa, suggestions, search, service RPCs and
-- final privilege hardening.

-- ---------------------------------------------------------------------------
-- Relationship helpers
-- ---------------------------------------------------------------------------

create or replace function app.friendship_state(p_viewer uuid, p_target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_viewer = p_target then 'self'
    else coalesce((
      select case
        when f.status = 'accepted' then 'friends'
        when f.requester_id = p_viewer then 'request_sent'
        else 'request_received'
      end
      from public.friendships f
      where least(f.requester_id, f.addressee_id) = least(p_viewer, p_target)
        and greatest(f.requester_id, f.addressee_id) = greatest(p_viewer, p_target)
    ), 'none')
  end;
$$;

create or replace function app.mutual_friend_count(a uuid, b uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  with fa as (
    select case when requester_id = a then addressee_id else requester_id end id
    from public.friendships where status = 'accepted' and a in (requester_id, addressee_id)
  ), fb as (
    select case when requester_id = b then addressee_id else requester_id end id
    from public.friendships where status = 'accepted' and b in (requester_id, addressee_id)
  )
  select count(*)::int from fa join fb using (id);
$$;

-- ---------------------------------------------------------------------------
-- Full profile view, filtered by the owner's privacy settings.
-- ---------------------------------------------------------------------------

create or replace function public.get_profile(p_username text default null, p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles;
  v_s public.user_privacy_settings;
  v_birth date;
  v_self boolean;
  v_details boolean;
  v_friends_visible boolean;
  v_dating boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_user_id is not null then
    select * into v_p from public.profiles where id = p_user_id;
  else
    select * into v_p from public.profiles where username = lower(p_username)::extensions.citext;
  end if;
  if not found or not app.profile_visible_to(v_p.id, v_uid) then
    return null;
  end if;

  select * into v_s from public.user_privacy_settings where user_id = v_p.id;
  select birth_date into v_birth from public.profile_private where user_id = v_p.id;
  v_self := v_p.id = v_uid;
  v_details := app.profile_details_visible_to(v_p.id, v_uid);
  v_friends_visible := v_self or v_s.friends_list_visibility = 'members'
    or (v_s.friends_list_visibility = 'friends' and app.are_friends(v_p.id, v_uid));
  select (d.enabled and not d.paused and (d.show_on_profile or v_self)) into v_dating
    from public.dating_preferences d where d.user_id = v_p.id;

  return jsonb_build_object(
    'id', v_p.id,
    'username', v_p.username,
    'display_name', v_p.display_name,
    'avatar_path', v_p.avatar_path,
    'cover_path', case when v_details then v_p.cover_path end,
    'country_code', v_p.country_code,
    'joined_at', v_p.created_at,
    'is_self', v_self,
    'details_visible', v_details,
    'bio', case when v_details then v_p.bio end,
    'region', case when v_details and (v_self or v_s.show_city) then v_p.region end,
    'city', case when v_details and (v_self or v_s.show_city) then v_p.city end,
    'age', case when v_birth is not null and (v_self or (v_details and v_s.show_age)) then app.age_on(v_birth) end,
    'languages', case when v_details then to_jsonb(v_p.languages) else '[]'::jsonb end,
    'interests', case when v_details then to_jsonb(v_p.interests) else '[]'::jsonb end,
    'hobbies', case when v_details then to_jsonb(v_p.hobbies) else '[]'::jsonb end,
    'intents', case when v_details then to_jsonb(v_p.intents) else '[]'::jsonb end,
    'open_to_dating', coalesce(v_dating, false),
    'friendship', app.friendship_state(v_uid, v_p.id),
    'friends_count', case when v_friends_visible then (
        select count(*) from public.friendships f
        where f.status = 'accepted' and v_p.id in (f.requester_id, f.addressee_id)) end,
    'friends_list_visible', v_friends_visible,
    'mutual_friends', case when v_self then 0 else app.mutual_friend_count(v_uid, v_p.id) end,
    'can_message', case when v_self then false else app.can_message(v_uid, v_p.id) end,
    'can_send_friend_request', not v_self and app.friendship_state(v_uid, v_p.id) = 'none'
       and v_s.friend_requests_from = 'everyone' and app.is_active(v_uid),
    'status', case when v_self or app.is_staff(v_uid) then v_p.status end
  );
end;
$$;

create or replace function public.list_blocked_users()
returns table (id uuid, username text, display_name text, avatar_path text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, b.created_at
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Discovery: people anywhere in Africa (no same-country restriction).
-- ---------------------------------------------------------------------------

create or replace function public.discover_people(
  p_country text default null,
  p_region text default null,
  p_city text default null,
  p_interests text[] default null,
  p_languages text[] default null,
  p_min_age int default null,
  p_max_age int default null,
  p_intent public.social_intent default null,
  p_max_distance_km int default null,
  p_query text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid, username text, display_name text, avatar_path text, country_code char(2), city text,
  age int, interests text[], languages text[], intents public.social_intent[], mutual_friends int,
  friendship text, distance_band text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active();
  v_loc extensions.geography;
  v_my_interests text[];
  v_q text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_interests text[] := nullif(app.normalize_tags(p_interests, 10), '{}');
begin
  perform app.hit_rate_limit('discover', 300, 3600);
  select pp.location into v_loc from public.profile_private pp
  join public.user_privacy_settings s on s.user_id = pp.user_id
  where pp.user_id = v_uid and s.location_enabled;
  select p.interests into v_my_interests from public.profiles p where p.id = v_uid;
  if p_max_distance_km is not null and v_loc is null then
    raise exception 'location_required' using errcode = '22023',
      hint = 'Turn on approximate location to filter by distance.';
  end if;

  return query
    select p.id, p.username::text, p.display_name, p.avatar_path, p.country_code,
           case when det.ok and s.show_city then p.city end,
           case when det.ok and s.show_age then app.age_on(pp.birth_date) end,
           case when det.ok then p.interests else '{}'::text[] end,
           case when det.ok then p.languages else '{}'::text[] end,
           case when det.ok then p.intents else '{}'::public.social_intent[] end,
           app.mutual_friend_count(v_uid, p.id),
           app.friendship_state(v_uid, p.id),
           case when v_loc is not null and s.location_enabled and pp.location is not null
                then app.distance_band(extensions.st_distance(v_loc, pp.location)) end
    from public.profiles p
    join public.user_privacy_settings s on s.user_id = p.id
    join public.profile_private pp on pp.user_id = p.id
    cross join lateral (select app.profile_details_visible_to(p.id, v_uid) as ok) det
    where p.status = 'active'
      and p.id <> v_uid
      and s.discoverable
      and not app.is_blocked_between(p.id, v_uid)
      and (p_country is null or p.country_code = upper(p_country))
      and (p_region is null or (s.show_city and det.ok and lower(p.region) = lower(btrim(p_region))))
      and (p_city is null or (s.show_city and det.ok and lower(p.city) = lower(btrim(p_city))))
      and (v_interests is null or (det.ok and p.interests && v_interests))
      and (p_languages is null or cardinality(p_languages) = 0 or (det.ok and p.languages && p_languages))
      and (p_intent is null or (det.ok and p_intent = any (p.intents)))
      and ((p_min_age is null and p_max_age is null)
           or (s.show_age and det.ok and app.age_on(pp.birth_date) between coalesce(p_min_age, 18) and coalesce(p_max_age, 120)))
      and (p_max_distance_km is null
           or (s.location_enabled and pp.location is not null
               and extensions.st_dwithin(v_loc, pp.location, p_max_distance_km * 1000.0)))
      and (v_q is null
           or p.username::text like '%' || v_q || '%'
           or lower(p.display_name) like '%' || v_q || '%'
           or extensions.similarity(lower(p.display_name), v_q) > 0.3
           or (det.ok and v_q = any (p.interests)))
    order by
      case when v_q is not null and p.username::text = v_q then 0 else 1 end,
      cardinality(array(select unnest(p.interests) intersect select unnest(v_my_interests))) desc,
      p.last_active_at desc nulls last,
      p.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- People you may know: friends of friends, shared interests, same area.
create or replace function public.suggest_people(p_limit int default 10)
returns table (
  id uuid, username text, display_name text, avatar_path text, country_code char(2),
  mutual_friends int, shared_interests int, reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.require_active();
  v_me public.profiles;
begin
  select * into v_me from public.profiles where profiles.id = v_uid;
  return query
    with my_friends as (
      select case when requester_id = v_uid then addressee_id else requester_id end fid
      from public.friendships where status = 'accepted' and v_uid in (requester_id, addressee_id)
    ),
    fof as (
      select case when f.requester_id = mf.fid then f.addressee_id else f.requester_id end cid, count(*)::int n
      from public.friendships f join my_friends mf on mf.fid in (f.requester_id, f.addressee_id)
      where f.status = 'accepted'
      group by 1
    ),
    candidates as (
      select p.id, coalesce(fof.n, 0) as mutual,
             cardinality(array(select unnest(p.interests) intersect select unnest(v_me.interests)))::int as shared,
             (p.country_code = v_me.country_code) as same_country,
             (p.city is not null and lower(p.city) = lower(v_me.city) and s.show_city) as same_city
      from public.profiles p
      join public.user_privacy_settings s on s.user_id = p.id
      left join fof on fof.cid = p.id
      where p.status = 'active' and p.id <> v_uid and s.discoverable
        and not app.is_blocked_between(p.id, v_uid)
        and not exists (select 1 from public.friendships f
                        where least(f.requester_id, f.addressee_id) = least(p.id, v_uid)
                          and greatest(f.requester_id, f.addressee_id) = greatest(p.id, v_uid))
        and (fof.n is not null or p.country_code = v_me.country_code or p.interests && v_me.interests)
    )
    select p.id, p.username::text, p.display_name, p.avatar_path, p.country_code, c.mutual, c.shared,
           case when c.mutual > 0 then 'mutual_friends'
                when c.shared > 0 then 'shared_interests'
                when c.same_city then 'same_city'
                else 'same_country' end
    from candidates c join public.profiles p on p.id = c.id
    order by (c.mutual * 3 + c.shared * 2 + c.same_city::int * 2 + c.same_country::int) desc, p.last_active_at desc nulls last
    limit least(greatest(coalesce(p_limit, 10), 1), 30);
end;
$$;

-- Cheap presence heartbeat (at most one write per 10 minutes).
create or replace function public.touch_last_active()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_active_at = now()
  where id = auth.uid() and (last_active_at is null or last_active_at < now() - interval '10 minutes');
$$;

-- ---------------------------------------------------------------------------
-- Service-role-only RPCs used by Edge Functions.
-- ---------------------------------------------------------------------------

create or replace function public.service_accounts_due_for_purge(p_limit int default 50)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select app.accounts_due_for_purge(p_limit);
$$;

create or replace function public.service_claim_storage_deletions(p_limit int default 200)
returns table (id bigint, bucket_id text, object_path text)
language sql
security definer
set search_path = ''
as $$
  update app.storage_deletion_queue q set processed_at = now()
  where q.id in (select id from app.storage_deletion_queue where processed_at is null order by id limit p_limit)
  returning q.id, q.bucket_id, q.object_path;
$$;

create or replace function public.service_release_storage_deletions(p_ids bigint[])
returns void
language sql
security definer
set search_path = ''
as $$
  update app.storage_deletion_queue set processed_at = null where id = any (p_ids);
$$;

-- ---------------------------------------------------------------------------
-- Privilege hardening
-- ---------------------------------------------------------------------------

-- No anonymous access to application tables (reference data excepted).
revoke all on all tables in schema public from anon;
grant select on public.countries, public.regions to anon;
alter default privileges in schema public revoke all on tables from anon;

-- Functions: authenticated members only; service RPCs: service role only.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon;

revoke execute on function public.service_accounts_due_for_purge(int) from authenticated;
revoke execute on function public.service_claim_storage_deletions(int) from authenticated;
revoke execute on function public.service_release_storage_deletions(bigint[]) from authenticated;

revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;
revoke execute on function app.accounts_due_for_purge(int) from authenticated;
revoke execute on function app.purge_rate_limits() from authenticated;
revoke all on all tables in schema app from public, anon, authenticated;

-- Housekeeping job (pg_cron is available on all Supabase plans).
create extension if not exists pg_cron;
select cron.schedule('patapata-purge-rate-limits', '17 3 * * *', 'select app.purge_rate_limits()');
