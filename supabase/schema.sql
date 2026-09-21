-- StatusGrid Supabase schema
-- Run this in Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  url text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.checks (
  id bigint generated always as identity primary key,
  site_id uuid not null references public.sites(id) on delete cascade,
  is_up boolean not null,
  status_code integer,
  response_time_ms integer,
  error_message text,
  checked_at timestamptz not null default now()
);

create index if not exists checks_site_checked_idx
  on public.checks (site_id, checked_at desc);

create index if not exists checks_checked_idx
  on public.checks (checked_at desc);

-- Keep the tables private from browser clients.
-- Vercel uses the service-role key server-side.
alter table public.sites enable row level security;
alter table public.checks enable row level security;

-- No public RLS policies are intentionally added.
