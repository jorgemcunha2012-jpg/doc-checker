create table public.developments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  city text,
  registration text,
  source_document_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.development_units (
  id uuid primary key default gen_random_uuid(),
  development_id uuid not null references public.developments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  tower text not null,
  unit text not null,
  private_area text not null,
  typology text,
  registration text,
  confidence numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (development_id, tower, unit)
);

create index developments_org_idx on public.developments(organization_id, name);
create index development_units_development_idx on public.development_units(development_id, tower, unit);

alter table public.developments enable row level security;
alter table public.development_units enable row level security;

create policy "organization members read developments" on public.developments
for select using (organization_id = (select organization_id from public.current_profile()));

create policy "organization members read development units" on public.development_units
for select using (organization_id = (select organization_id from public.current_profile()));
