alter table public.profiles
add column if not exists is_master_admin boolean not null default false;

update public.profiles
set is_master_admin = true
where lower(email) = 'jorge@conferia.local';

drop policy if exists "process visibility" on public.validation_processes;
create policy "process visibility" on public.validation_processes
for select using (
  organization_id = (select organization_id from public.current_profile())
  and (user_id = auth.uid() or (select is_master_admin from public.current_profile()))
);

drop policy if exists "document metadata visibility" on public.process_documents;
create policy "document metadata visibility" on public.process_documents
for select using (
  exists (
    select 1 from public.validation_processes p
    where p.id = process_id
      and p.organization_id = (select organization_id from public.current_profile())
      and (p.user_id = auth.uid() or (select is_master_admin from public.current_profile()))
  )
);

drop policy if exists "result visibility" on public.validation_results;
create policy "result visibility" on public.validation_results
for select using (
  exists (
    select 1 from public.validation_processes p
    where p.id = process_id
      and p.organization_id = (select organization_id from public.current_profile())
      and (p.user_id = auth.uid() or (select is_master_admin from public.current_profile()))
  )
);

drop policy if exists "review visibility" on public.human_reviews;
create policy "review visibility" on public.human_reviews
for select using (
  exists (
    select 1 from public.validation_processes p
    where p.id = process_id
      and p.organization_id = (select organization_id from public.current_profile())
      and (p.user_id = auth.uid() or (select is_master_admin from public.current_profile()))
  )
);

drop policy if exists "audit admin only" on public.audit_events;
create policy "audit master admin only" on public.audit_events
for select using (
  organization_id = (select organization_id from public.current_profile())
  and (select is_master_admin from public.current_profile())
);
