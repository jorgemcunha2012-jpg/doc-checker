alter table public.human_reviews
drop constraint if exists human_reviews_justification_check;

alter table public.human_reviews
alter column justification set default '';
