-- Patapata foundation: extensions, private helper schema, shared utilities,
-- generic rate limiting, and reference data (countries / regions).
--
-- Conventions used across all migrations:
--   * `public` holds tables and RPCs exposed through the Supabase Data API.
--   * `app` holds private helpers. It is NOT in the API's exposed schemas, so
--     functions there can only be reached through RLS policies, triggers and
--     public RPCs.
--   * Every exposed table has RLS enabled. Writes that need multi-row
--     consistency (friend requests, blocking, posting with media, reports,
--     moderation) go through SECURITY DEFINER RPCs that re-check permissions.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists postgis with schema extensions;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Normalises a free-text tag list (interests, hobbies): trims, lower-cases,
-- removes blanks and duplicates, and caps the number of entries.
create or replace function app.normalize_tags(tags text[], max_items int default 20)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(t order by first_pos), '{}')
  from (
    select t, min(pos) as first_pos
    from unnest(coalesce(tags, '{}')) with ordinality as u(raw, pos),
         lateral (select lower(btrim(regexp_replace(raw, '\s+', ' ', 'g'))) as t) n
    where length(t) between 2 and 30
    group by t
    order by min(pos)
    limit max_items
  ) s;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting
--
-- Fixed-window counters keyed by (user, bucket, window start). Call
-- app.hit_rate_limit() from triggers or RPCs; it raises `rate_limited`
-- (SQLSTATE P0001, message prefix "rate_limited") once the limit is exceeded.
-- ---------------------------------------------------------------------------

create table app.rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (user_id, bucket, window_start)
);
create index rate_limits_window_idx on app.rate_limits (window_start);

create or replace function app.hit_rate_limit(
  p_bucket text,
  p_limit int,
  p_window_seconds int,
  p_user uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits int;
begin
  if p_user is null then
    return; -- service role / migrations are not rate limited
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into app.rate_limits as r (user_id, bucket, window_start, hits)
  values (p_user, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  if v_hits > p_limit then
    raise exception 'rate_limited: too many % actions, please try again later', p_bucket
      using errcode = 'P0001', hint = 'rate_limited';
  end if;
end;
$$;

-- Old windows are useless after a day; purge them (also scheduled via pg_cron
-- in production, see docs/OPERATIONS.md).
create or replace function app.purge_rate_limits()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from app.rate_limits where window_start < now() - interval '2 days';
$$;

-- ---------------------------------------------------------------------------
-- Reference data: countries and administrative regions
-- ---------------------------------------------------------------------------

create type public.african_region as enum (
  'northern', 'western', 'central', 'eastern', 'southern'
);

create table public.countries (
  code char(2) primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  calling_code text not null check (calling_code ~ '^\+[0-9]{1,4}$'),
  region public.african_region not null,
  default_locale text not null default 'en',
  flag_emoji text not null,
  is_launch_market boolean not null default false,
  is_enabled boolean not null default true
);

create table public.regions (
  id bigint generated always as identity primary key,
  country_code char(2) not null references public.countries (code) on delete cascade,
  name text not null,
  unique (country_code, name)
);

alter table public.countries enable row level security;
alter table public.regions enable row level security;
create policy "countries are readable by everyone" on public.countries for select using (true);
create policy "regions are readable by everyone" on public.regions for select using (true);
revoke insert, update, delete on public.countries, public.regions from anon, authenticated;

-- Flag emoji are derived from the ISO code (regional indicator symbols).
create or replace function app.flag_for(code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select chr(127397 + ascii(substr(code, 1, 1))) || chr(127397 + ascii(substr(code, 2, 1)));
$$;

insert into public.countries (code, name, calling_code, region, default_locale, flag_emoji, is_launch_market)
select c.code, c.name, c.calling_code, c.region::public.african_region, c.locale, app.flag_for(c.code), c.code = 'ZA'
from (values
  -- Northern Africa
  ('DZ', 'Algeria', '+213', 'northern', 'ar'),
  ('EG', 'Egypt', '+20', 'northern', 'ar'),
  ('LY', 'Libya', '+218', 'northern', 'ar'),
  ('MA', 'Morocco', '+212', 'northern', 'ar'),
  ('MR', 'Mauritania', '+222', 'northern', 'ar'),
  ('SD', 'Sudan', '+249', 'northern', 'ar'),
  ('TN', 'Tunisia', '+216', 'northern', 'ar'),
  -- Western Africa
  ('BJ', 'Benin', '+229', 'western', 'fr'),
  ('BF', 'Burkina Faso', '+226', 'western', 'fr'),
  ('CV', 'Cabo Verde', '+238', 'western', 'pt'),
  ('CI', 'Côte d''Ivoire', '+225', 'western', 'fr'),
  ('GM', 'The Gambia', '+220', 'western', 'en'),
  ('GH', 'Ghana', '+233', 'western', 'en'),
  ('GN', 'Guinea', '+224', 'western', 'fr'),
  ('GW', 'Guinea-Bissau', '+245', 'western', 'pt'),
  ('LR', 'Liberia', '+231', 'western', 'en'),
  ('ML', 'Mali', '+223', 'western', 'fr'),
  ('NE', 'Niger', '+227', 'western', 'fr'),
  ('NG', 'Nigeria', '+234', 'western', 'en'),
  ('SN', 'Senegal', '+221', 'western', 'fr'),
  ('SL', 'Sierra Leone', '+232', 'western', 'en'),
  ('TG', 'Togo', '+228', 'western', 'fr'),
  -- Central Africa
  ('AO', 'Angola', '+244', 'central', 'pt'),
  ('CM', 'Cameroon', '+237', 'central', 'fr'),
  ('CF', 'Central African Republic', '+236', 'central', 'fr'),
  ('TD', 'Chad', '+235', 'central', 'fr'),
  ('CG', 'Republic of the Congo', '+242', 'central', 'fr'),
  ('CD', 'DR Congo', '+243', 'central', 'fr'),
  ('GQ', 'Equatorial Guinea', '+240', 'central', 'es'),
  ('GA', 'Gabon', '+241', 'central', 'fr'),
  ('ST', 'São Tomé and Príncipe', '+239', 'central', 'pt'),
  -- Eastern Africa
  ('BI', 'Burundi', '+257', 'eastern', 'fr'),
  ('KM', 'Comoros', '+269', 'eastern', 'fr'),
  ('DJ', 'Djibouti', '+253', 'eastern', 'fr'),
  ('ER', 'Eritrea', '+291', 'eastern', 'en'),
  ('ET', 'Ethiopia', '+251', 'eastern', 'en'),
  ('KE', 'Kenya', '+254', 'eastern', 'sw'),
  ('MG', 'Madagascar', '+261', 'eastern', 'fr'),
  ('MW', 'Malawi', '+265', 'eastern', 'en'),
  ('MU', 'Mauritius', '+230', 'eastern', 'en'),
  ('MZ', 'Mozambique', '+258', 'eastern', 'pt'),
  ('RW', 'Rwanda', '+250', 'eastern', 'en'),
  ('SC', 'Seychelles', '+248', 'eastern', 'en'),
  ('SO', 'Somalia', '+252', 'eastern', 'en'),
  ('SS', 'South Sudan', '+211', 'eastern', 'en'),
  ('TZ', 'Tanzania', '+255', 'eastern', 'sw'),
  ('UG', 'Uganda', '+256', 'eastern', 'en'),
  ('ZM', 'Zambia', '+260', 'eastern', 'en'),
  ('ZW', 'Zimbabwe', '+263', 'eastern', 'en'),
  -- Southern Africa
  ('BW', 'Botswana', '+267', 'southern', 'en'),
  ('SZ', 'Eswatini', '+268', 'southern', 'en'),
  ('LS', 'Lesotho', '+266', 'southern', 'en'),
  ('NA', 'Namibia', '+264', 'southern', 'en'),
  ('ZA', 'South Africa', '+27', 'southern', 'en')
) as c(code, name, calling_code, region, locale);

-- Administrative regions for the first markets. Other countries fall back to
-- a free-text region; more can be added without code changes.
insert into public.regions (country_code, name)
select 'ZA', unnest(array['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'])
union all
select 'NG', unnest(array['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Federal Capital Territory',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara'])
union all
select 'GH', unnest(array['Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West',
  'Volta', 'Western', 'Western North'])
union all
select 'KE', unnest(array['Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu',
  'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi',
  'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni',
  'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang''a', 'Nairobi', 'Nakuru', 'Nandi',
  'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River',
  'Tharaka-Nithi', 'Trans-Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot']);
