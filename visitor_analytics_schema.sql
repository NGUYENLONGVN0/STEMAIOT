-- STEM AIOT Visitor Analytics
-- Run in Supabase SQL Editor.
create table if not exists public.visitor_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_type text not null check (event_type in ('page_view','gps_shared')),
  device_type text not null check (device_type in ('mobile','tablet','desktop')),
  platform text not null default 'Unknown',
  browser text not null default 'Other',
  language text,
  screen text,
  page_path text,
  referrer_host text,
  gps_latitude double precision,
  gps_longitude double precision,
  gps_accuracy_m integer,
  ip_country text,
  ip_region text,
  ip_city text,
  constraint gps_lat_valid check (gps_latitude is null or gps_latitude between -90 and 90),
  constraint gps_lon_valid check (gps_longitude is null or gps_longitude between -180 and 180)
);

alter table public.visitor_events enable row level security;

-- Public clients must NOT read analytics records or write directly to the table.
revoke all on public.visitor_events from anon, authenticated;
grant select on public.visitor_events to authenticated;

drop policy if exists "Admin can read visitor analytics" on public.visitor_events;
create policy "Admin can read visitor analytics"
on public.visitor_events for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Insert is performed only by the Edge Function using the server-side service role key.
-- Never put SUPABASE_SERVICE_ROLE_KEY in HTML, JavaScript, or a public repository.
