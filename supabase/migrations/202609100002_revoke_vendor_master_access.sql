-- Remove privilégios implícitos de contas internas do fornecedor em instalações já existentes.
update public.profiles
set active = false,
    is_master_admin = false,
    updated_at = now()
where lower(email) like '%@conferia.local';
