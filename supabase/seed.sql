-- Local development seed data. Runs on `supabase start` / `supabase db reset`.
-- Test accounts (password for both: password123):
--   alice@example.com
--   bob@example.com

create extension if not exists pgcrypto with schema extensions;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'a1111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'alice@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Alice"}', now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b2222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'bob@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Bob"}', now(), now(),
    '', '', '', ''
  );

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  (
    gen_random_uuid(), 'a1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    '{"sub":"a1111111-1111-1111-1111-111111111111","email":"alice@example.com","email_verified":true}',
    'email', now(), now(), now()
  ),
  (
    gen_random_uuid(), 'b2222222-2222-2222-2222-222222222222',
    'b2222222-2222-2222-2222-222222222222',
    '{"sub":"b2222222-2222-2222-2222-222222222222","email":"bob@example.com","email_verified":true}',
    'email', now(), now(), now()
  );

-- Profiles are created by the on_auth_user_created trigger.
-- Lists: the on_list_created trigger adds the owner as a member.
insert into public.lists (id, name, owner_id) values
  ('c1111111-0000-0000-0000-000000000001', 'Groceries', 'a1111111-1111-1111-1111-111111111111'),
  ('c1111111-0000-0000-0000-000000000002', 'Weekend jobs', 'a1111111-1111-1111-1111-111111111111');

-- Groceries is shared with Bob.
insert into public.list_members (list_id, user_id, role) values
  ('c1111111-0000-0000-0000-000000000001', 'b2222222-2222-2222-2222-222222222222', 'editor');

insert into public.items (list_id, title, is_done, created_by) values
  ('c1111111-0000-0000-0000-000000000001', 'Milk',   false, 'a1111111-1111-1111-1111-111111111111'),
  ('c1111111-0000-0000-0000-000000000001', 'Bread',  true,  'b2222222-2222-2222-2222-222222222222'),
  ('c1111111-0000-0000-0000-000000000001', 'Eggs',   false, 'b2222222-2222-2222-2222-222222222222'),
  ('c1111111-0000-0000-0000-000000000002', 'Fix the bike', false, 'a1111111-1111-1111-1111-111111111111'),
  ('c1111111-0000-0000-0000-000000000002', 'Mow the lawn', false, 'a1111111-1111-1111-1111-111111111111');
