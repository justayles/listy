-- Realtime only sends list_id on UPDATE/DELETE when replica identity is FULL.
-- Without it, the other member gets INSERT (add item) but not complete/edit/delete.
alter table public.items replica identity full;
alter table public.list_members replica identity full;
alter table public.lists replica identity full;
