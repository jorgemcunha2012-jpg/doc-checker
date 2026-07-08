alter table public.development_units
add column if not exists total_area text,
add column if not exists ideal_fraction text;
