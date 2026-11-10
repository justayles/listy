-- Shared todo app schema: profiles, lists, list_members, items + RLS + realtime.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now()
);
create unique index profiles_email_lower_idx on public.profiles (lower(email));

create table public.lists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 100),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index lists_owner_id_idx on public.lists (owner_id);

create table public.list_members (
  list_id    uuid not null references public.lists (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'editor' check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);
create index list_members_user_id_idx on public.list_members (user_id);

create table public.items (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.lists (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 500),
  is_done    boolean not null default false,
  position   double precision not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index items_list_id_idx on public.items (list_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so RLS policies don't recurse)
-- ---------------------------------------------------------------------------

create function public.is_list_member(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.list_members
    where list_id = p_list_id and user_id = auth.uid()
  );
$$;

create function public.is_list_owner(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lists
    where id = p_list_id and owner_id = auth.uid()
  );
$$;

create function public.shares_list_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.list_members me
    join public.list_members other on other.list_id = me.list_id
    where me.user_id = auth.uid() and other.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Create a profile whenever a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The creator of a list becomes its owner member.
create function public.handle_new_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.list_members (list_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_list_created
  after insert on public.lists
  for each row execute function public.handle_new_list();

-- ---------------------------------------------------------------------------
-- Sharing RPC: owner shares a list with an existing user by email.
-- ---------------------------------------------------------------------------

create function public.share_list(p_list_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not public.is_list_owner(p_list_id) then
    raise exception 'Only the list owner can share this list' using errcode = '42501';
  end if;

  select id into v_user_id
  from public.profiles
  where lower(email) = lower(btrim(p_email));

  if v_user_id is null then
    raise exception 'No user found with that email' using errcode = 'P0002';
  end if;

  insert into public.list_members (list_id, user_id, role)
  values (p_list_id, v_user_id, 'editor')
  on conflict (list_id, user_id) do nothing;
end;
$$;

revoke all on function public.share_list(uuid, text) from public, anon;
grant execute on function public.share_list(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.lists        enable row level security;
alter table public.list_members enable row level security;
alter table public.items        enable row level security;

-- profiles: see yourself and anyone you share a list with.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_list_with(id));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- lists: members can read, any user can create their own, only owner can rename/delete.
create policy "lists_select" on public.lists
  for select to authenticated
  using (owner_id = auth.uid() or public.is_list_member(id));

create policy "lists_insert" on public.lists
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "lists_update" on public.lists
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "lists_delete" on public.lists
  for delete to authenticated
  using (owner_id = auth.uid());

-- list_members: members see co-members; members are added via share_list();
-- owner can remove others, and anyone can leave a list they don't own.
create policy "list_members_select" on public.list_members
  for select to authenticated
  using (public.is_list_member(list_id));

create policy "list_members_delete" on public.list_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (public.is_list_owner(list_id) or user_id = auth.uid())
  );

-- items: any member can read and write.
create policy "items_select" on public.items
  for select to authenticated
  using (public.is_list_member(list_id));

create policy "items_insert" on public.items
  for insert to authenticated
  with check (public.is_list_member(list_id));

create policy "items_update" on public.items
  for update to authenticated
  using (public.is_list_member(list_id))
  with check (public.is_list_member(list_id));

create policy "items_delete" on public.items
  for delete to authenticated
  using (public.is_list_member(list_id));

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.lists, public.list_members, public.items from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.lists to authenticated;
grant select, delete on public.list_members to authenticated;
grant select, insert, update, delete on public.items to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.items        replica identity full;
alter table public.list_members replica identity full;

alter publication supabase_realtime add table public.lists, public.list_members, public.items;
