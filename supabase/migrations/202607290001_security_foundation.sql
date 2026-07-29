alter table public.profiles
add column if not exists is_master_admin boolean not null default false,
add column if not exists mfa_required boolean not null default false,
add column if not exists last_login_at timestamptz,
add column if not exists password_changed_at timestamptz;

alter table public.process_documents
add column if not exists purged_at timestamptz,
add column if not exists purge_reason text,
add column if not exists purge_attempts integer not null default 0,
add column if not exists purge_error text;

update public.organizations
set name = 'Victa Engenharia'
where id = '00000000-0000-0000-0000-000000000001'
  and name = 'ConferIA Operações';

update public.profiles
set is_master_admin = lower(email) = 'jorge@conferia.local',
    mfa_required = active,
    must_change_password = case when active then true else must_change_password end,
    updated_at = now()
where organization_id = '00000000-0000-0000-0000-000000000001';

update public.profiles
set active = false,
    is_master_admin = false,
    updated_at = now()
where lower(email) = 'publico@conferia.local';

create index if not exists process_documents_retention_idx
on public.process_documents(created_at, id)
where storage_path is not null and purged_at is null;

create index if not exists profiles_org_active_idx
on public.profiles(organization_id, active, created_at);

create index if not exists audit_events_security_idx
on public.audit_events(event_type, created_at desc);

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.profiles
  where id = auth.uid()
    and active = true
$$;

drop policy if exists "organization members read organization" on public.organizations;
create policy "organization visibility" on public.organizations
for select using (
  id = (select organization_id from public.current_profile())
  or (select is_master_admin from public.current_profile())
);

drop policy if exists "users read own profile admins read organization" on public.profiles;
create policy "profile visibility" on public.profiles
for select using (
  (select is_master_admin from public.current_profile())
  or id = auth.uid()
  or (
    organization_id = (select organization_id from public.current_profile())
    and (select role from public.current_profile()) = 'ADMIN'
  )
);

drop policy if exists "process visibility" on public.validation_processes;
create policy "process visibility" on public.validation_processes
for select using (
  (select is_master_admin from public.current_profile())
  or (
    organization_id = (select organization_id from public.current_profile())
    and (
      user_id = auth.uid()
      or (select role from public.current_profile()) = 'ADMIN'
    )
  )
);

drop policy if exists "document metadata visibility" on public.process_documents;
create policy "document metadata visibility" on public.process_documents
for select using (
  exists (
    select 1
    from public.validation_processes process
    where process.id = process_id
      and (
        (select is_master_admin from public.current_profile())
        or (
          process.organization_id = (select organization_id from public.current_profile())
          and (
            process.user_id = auth.uid()
            or (select role from public.current_profile()) = 'ADMIN'
          )
        )
      )
  )
);

drop policy if exists "result visibility" on public.validation_results;
create policy "result visibility" on public.validation_results
for select using (
  exists (
    select 1
    from public.validation_processes process
    where process.id = process_id
      and (
        (select is_master_admin from public.current_profile())
        or (
          process.organization_id = (select organization_id from public.current_profile())
          and (
            process.user_id = auth.uid()
            or (select role from public.current_profile()) = 'ADMIN'
          )
        )
      )
  )
);

drop policy if exists "review visibility" on public.human_reviews;
create policy "review visibility" on public.human_reviews
for select using (
  exists (
    select 1
    from public.validation_processes process
    where process.id = process_id
      and (
        (select is_master_admin from public.current_profile())
        or (
          process.organization_id = (select organization_id from public.current_profile())
          and (
            process.user_id = auth.uid()
            or (select role from public.current_profile()) = 'ADMIN'
          )
        )
      )
  )
);

drop policy if exists "audit admin only" on public.audit_events;
drop policy if exists "audit master admin only" on public.audit_events;
create policy "audit visibility" on public.audit_events
for select using (
  (select is_master_admin from public.current_profile())
  or (
    organization_id = (select organization_id from public.current_profile())
    and (select role from public.current_profile()) = 'ADMIN'
  )
);

drop policy if exists "organization members read developments" on public.developments;
create policy "development visibility" on public.developments
for select using (
  (select is_master_admin from public.current_profile())
  or organization_id = (select organization_id from public.current_profile())
);

drop policy if exists "organization members read development units" on public.development_units;
create policy "development unit visibility" on public.development_units
for select using (
  (select is_master_admin from public.current_profile())
  or organization_id = (select organization_id from public.current_profile())
);

drop policy if exists "learned equivalence master admin only" on public.learned_field_equivalences;
create policy "learned equivalence admin visibility" on public.learned_field_equivalences
for select using (
  (select is_master_admin from public.current_profile())
  or (
    organization_id = (select organization_id from public.current_profile())
    and (select role from public.current_profile()) = 'ADMIN'
  )
);
