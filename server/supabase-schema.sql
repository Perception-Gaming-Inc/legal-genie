-- Legal Genie — Supabase schema
-- Run this once in your Supabase project's SQL editor (Dashboard -> SQL
-- Editor -> New query -> paste this whole file -> Run) before the app's
-- first deploy. See the Go-Live Guide for the full setup walkthrough.

create table if not exists records (
  collection text not null,
  id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  -- version: added 2026-08-12 for optimistic-locking updates (see
  -- server/store.js's update()) — every write is conditioned on
  -- `version = <the version this request last read>`, so two concurrent
  -- edits to the same record can't silently overwrite one another anymore.
  -- Defaults to 1 so this column works for brand-new installs running this
  -- file for the first time; an EXISTING database (created before this
  -- column existed) needs the separate `alter table` migration a few lines
  -- down, since `create table if not exists` does nothing to a table that
  -- already exists.
  version integer not null default 1,
  primary key (collection, id)
);

create index if not exists idx_records_collection on records (collection);

-- One-time migration for a database that already had this schema applied
-- before the `version` column existed above — safe/idempotent to run even
-- if the column is already there (e.g. on a brand-new install where the
-- create table above just added it already).
alter table records add column if not exists version integer not null default 1;

create table if not exists counters (
  seq text primary key,
  value integer not null default 0
);

-- Atomic "increment and return the new value" used for human-readable
-- numbers like CASE-0001 / CTR-0001. A plain upsert from the JS client
-- can't express "value = value + 1" safely under concurrent requests —
-- this function does the increment on the database side instead.
create or replace function increment_counter(seq_name text)
returns integer as $$
declare
  new_value integer;
begin
  insert into counters (seq, value) values (seq_name, 1)
  on conflict (seq) do update set value = counters.value + 1
  returning value into new_value;
  return new_value;
end;
$$ language plpgsql;

-- Row Level Security is intentionally left OFF on these tables. This app's
-- own server-side code (server/routes.js, server/auth.js) already enforces
-- every permission check before it ever calls the database, and it always
-- connects using the service role (or new "secret") key — never the public
-- anon/publishable key — so RLS would be redundant here. Do not expose
-- SUPABASE_URL + the anon/publishable key to the browser for direct access
-- to these tables without adding RLS policies first.

-- Explicit grants for the service_role connection this app always uses.
-- Newer Supabase projects let you turn OFF "Automatically expose new
-- tables" at project-creation time (Supabase's own recommended, more
-- secure default) — when that's off, NO role (not even service_role) gets
-- default access to a newly created table, so without the grants below the
-- app would get permission errors even though it's using the elevated key.
-- These grants intentionally go to service_role only, not anon/authenticated
-- — this app never uses the anon/publishable key, and keeping this table
-- ungranted to anon/authenticated is a stronger security posture than the
-- old "grant to all three roles by default" behavior anyway. Safe to run
-- even if your project used the old default (or you left "Automatically
-- expose new tables" checked) — these are additive and idempotent.
grant usage on schema public to service_role;
grant select, insert, update, delete on records to service_role;
grant select, insert, update, delete on counters to service_role;
grant execute on function increment_counter(text) to service_role;
