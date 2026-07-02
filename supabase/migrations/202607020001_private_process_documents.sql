alter table public.process_documents
add column if not exists storage_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'process-documents',
  'process-documents',
  false,
  15728640,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create index if not exists process_documents_storage_idx
on public.process_documents(process_id, storage_path)
where storage_path is not null;
