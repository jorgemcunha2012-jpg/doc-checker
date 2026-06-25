create extension if not exists pgcrypto;

create type public.user_role as enum ('ADMIN', 'ANALISTA');
create type public.process_final_status as enum ('IN_PROGRESS', 'PENDING_REVIEW', 'FULLY_CHECKED', 'FAILED');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id),
  name text not null,
  email text not null unique,
  role public.user_role not null default 'ANALISTA',
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.validation_processes (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id),
  validation_type text not null,
  processing_status text not null,
  final_status public.process_final_status not null default 'IN_PROGRESS',
  result jsonb,
  summary jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.process_documents (
  id uuid primary key,
  process_id uuid not null references public.validation_processes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  name text not null,
  document_type text not null,
  source text,
  mime_type text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table public.validation_results (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.validation_processes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  field_id text not null,
  field_label text not null,
  field_category text not null,
  automatic_status text not null,
  observation text not null,
  values_by_source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(process_id, field_id)
);

create table public.human_reviews (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.validation_processes(id) on delete cascade,
  field_id text not null,
  organization_id uuid not null references public.organizations(id),
  status text not null check (status in ('APPROVED', 'REJECTED')),
  justification text not null check (length(trim(justification)) >= 5),
  reviewer_id uuid not null references public.profiles(id),
  reviewer_name text not null,
  reviewed_at timestamptz not null default now(),
  unique(process_id, field_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid references public.profiles(id),
  event_type text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index validation_processes_user_idx on public.validation_processes(user_id, started_at desc);
create index validation_processes_org_idx on public.validation_processes(organization_id, started_at desc);
create index audit_events_org_idx on public.audit_events(organization_id, created_at desc);

create or replace function public.current_profile()
returns public.profiles language sql stable security definer set search_path = public
as $$ select * from public.profiles where id = auth.uid() and active = true $$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.validation_processes enable row level security;
alter table public.process_documents enable row level security;
alter table public.validation_results enable row level security;
alter table public.human_reviews enable row level security;
alter table public.audit_events enable row level security;

create policy "organization members read organization" on public.organizations
for select using (id = (select organization_id from public.current_profile()));

create policy "users read own profile admins read organization" on public.profiles
for select using (
  id = auth.uid() or (
    organization_id = (select organization_id from public.current_profile())
    and (select role from public.current_profile()) = 'ADMIN'
  )
);

create policy "process visibility" on public.validation_processes
for select using (
  organization_id = (select organization_id from public.current_profile())
  and (user_id = auth.uid() or (select role from public.current_profile()) = 'ADMIN')
);

create policy "document metadata visibility" on public.process_documents
for select using (
  exists (
    select 1 from public.validation_processes p
    where p.id = process_id
      and p.organization_id = (select organization_id from public.current_profile())
      and (p.user_id = auth.uid() or (select role from public.current_profile()) = 'ADMIN')
  )
);

create policy "result visibility" on public.validation_results
for select using (
  exists (
    select 1 from public.validation_processes p
    where p.id = process_id
      and p.organization_id = (select organization_id from public.current_profile())
      and (p.user_id = auth.uid() or (select role from public.current_profile()) = 'ADMIN')
  )
);

create policy "review visibility" on public.human_reviews
for select using (
  exists (
    select 1 from public.validation_processes p
    where p.id = process_id
      and p.organization_id = (select organization_id from public.current_profile())
      and (p.user_id = auth.uid() or (select role from public.current_profile()) = 'ADMIN')
  )
);

create policy "audit admin only" on public.audit_events
for select using (
  organization_id = (select organization_id from public.current_profile())
  and (select role from public.current_profile()) = 'ADMIN'
);

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'ConferIA Operações')
on conflict (id) do nothing;
