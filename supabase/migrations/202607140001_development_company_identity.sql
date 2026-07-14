alter table public.developments
  add column if not exists seller_legal_name text,
  add column if not exists seller_cnpj text;

alter table public.development_units
  add column if not exists iptu_registration text;
