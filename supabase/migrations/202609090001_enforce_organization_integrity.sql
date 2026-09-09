-- Prevent a service-role write bug from associating child records with a
-- different organization than their parent process or development.

create or replace function public.assert_process_owner_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_organization_id uuid;
begin
  select organization_id into profile_organization_id
  from public.profiles
  where id = new.user_id;

  if profile_organization_id is null or profile_organization_id <> new.organization_id then
    raise exception 'validation_processes organization does not match its owner profile';
  end if;

  return new;
end;
$$;

create or replace function public.assert_process_child_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  process_organization_id uuid;
begin
  select organization_id into process_organization_id
  from public.validation_processes
  where id = new.process_id;

  if process_organization_id is null or process_organization_id <> new.organization_id then
    raise exception 'process child organization does not match its validation process';
  end if;

  return new;
end;
$$;

create or replace function public.assert_development_unit_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  development_organization_id uuid;
begin
  select organization_id into development_organization_id
  from public.developments
  where id = new.development_id;

  if development_organization_id is null or development_organization_id <> new.organization_id then
    raise exception 'development unit organization does not match its development';
  end if;

  return new;
end;
$$;

drop trigger if exists validation_processes_owner_organization_guard on public.validation_processes;
create trigger validation_processes_owner_organization_guard
before insert or update of user_id, organization_id on public.validation_processes
for each row execute function public.assert_process_owner_organization();

drop trigger if exists process_documents_organization_guard on public.process_documents;
create trigger process_documents_organization_guard
before insert or update of process_id, organization_id on public.process_documents
for each row execute function public.assert_process_child_organization();

drop trigger if exists validation_results_organization_guard on public.validation_results;
create trigger validation_results_organization_guard
before insert or update of process_id, organization_id on public.validation_results
for each row execute function public.assert_process_child_organization();

drop trigger if exists human_reviews_organization_guard on public.human_reviews;
create trigger human_reviews_organization_guard
before insert or update of process_id, organization_id on public.human_reviews
for each row execute function public.assert_process_child_organization();

drop trigger if exists development_units_organization_guard on public.development_units;
create trigger development_units_organization_guard
before insert or update of development_id, organization_id on public.development_units
for each row execute function public.assert_development_unit_organization();
