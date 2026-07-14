alter table public.developments
  add column if not exists seller_legal_name text,
  add column if not exists seller_cnpj text;
