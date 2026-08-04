-- Legal Genie — Supabase schema
-- Run this once in your Supabase project's SQL editor (Dashboard -> SQL
-- Editor -> New query -> paste this whole file -> Run) before the app's
-- first deploy. See the Go-Live Guide for the full setup walkthrough.

create table if not exists records (
  collection text not null,
  id text not null,
  data jsonb not null,
  created_at timestamptz default now(),
  primary key (collection, id)
);

create index if not exists idx_records_collection on records (collection);

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
-- connects using the service role key (never the public anon key), so RLS
-- would be redundant here. Do not expose SUPABASE_URL/SUPABASE_ANON_KEY-based
-- direct browser access to these tables without adding RLS policies first.
