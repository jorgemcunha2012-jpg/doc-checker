create table if not exists public.learned_field_equivalences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  field_id text not null,
  field_type text not null,
  rule_kind text not null check (rule_kind in ('MARITAL_STATUS_GENDER', 'OPTIONAL_ZERO', 'TEXT_ALIAS')),
  signature text not null,
  normalized_values text[] not null default '{}',
  example_values jsonb not null default '{}'::jsonb,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  active boolean not null default true,
  first_process_id uuid references public.validation_processes(id) on delete set null,
  last_process_id uuid references public.validation_processes(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  last_reviewer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, field_id, signature)
);

create index if not exists learned_field_equivalences_org_idx
on public.learned_field_equivalences(organization_id, field_id)
where active = true;

alter table public.learned_field_equivalences enable row level security;

drop policy if exists "learned equivalence master admin only" on public.learned_field_equivalences;
create policy "learned equivalence master admin only" on public.learned_field_equivalences
for select using (
  organization_id = (select organization_id from public.current_profile())
  and (select is_master_admin from public.current_profile())
);
