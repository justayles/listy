// Integration test for list sharing, RLS and Realtime against the LOCAL Supabase stack.
// Prereq: `npx supabase start` (seed users alice/bob are created by supabase/seed.sql).
// Run:    npm run test:sharing
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_KEY;
if (!key) throw new Error('Set SUPABASE_KEY (publishable key from `npx supabase status`)');

const newClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn(email, password = 'password123') {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client, userId: data.user.id };
}

async function must(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}\n       ${e.message}`);
    process.exitCode = 1;
  }
}

const stamp = Date.now();
const carolEmail = `carol+${stamp}@example.com`;

const alice = await signIn('alice@example.com');
const bob = await signIn('bob@example.com');

// A third user, signed up through the normal API, to test "no access".
const carolClient = newClient();
const { data: carolSignUp, error: carolErr } = await carolClient.auth.signUp({
  email: carolEmail,
  password: 'password123',
  options: { data: { display_name: 'Carol' } },
});
if (carolErr) throw carolErr;
const carol = { client: carolClient, userId: carolSignUp.user.id };

let listId;
let itemId;

console.log('Sharing / RLS tests');

await test('signing up creates a profile', async () => {
  const profile = await must(carol.client.from('profiles').select('*').eq('id', carol.userId).single());
  assert.equal(profile.email, carolEmail);
  assert.equal(profile.display_name, 'Carol');
});

await test('creating a list makes the creator an owner member', async () => {
  const list = await must(alice.client.from('lists').insert({ name: `Test ${stamp}` }).select('id, owner_id').single());
  listId = list.id;
  assert.equal(list.owner_id, alice.userId);
  const members = await must(alice.client.from('list_members').select('user_id, role').eq('list_id', listId));
  assert.deepEqual(members, [{ user_id: alice.userId, role: 'owner' }]);
});

await test('non-members cannot see the list or its items', async () => {
  const lists = await must(bob.client.from('lists').select('id').eq('id', listId));
  assert.equal(lists.length, 0);
  const { error } = await bob.client.from('items').insert({ list_id: listId, title: 'sneaky' });
  assert.ok(error, 'insert by non-member should be rejected');
});

await test('owner can add items', async () => {
  const item = await must(alice.client.from('items').insert({ list_id: listId, title: 'Milk' }).select('id').single());
  itemId = item.id;
});

await test('only the owner can share (bob cannot share alice list)', async () => {
  const { error } = await bob.client.rpc('share_list', { p_list_id: listId, p_email: carolEmail });
  assert.ok(error, 'non-owner share should fail');
});

await test('sharing with an unknown email fails with a clear error', async () => {
  const { error } = await alice.client.rpc('share_list', { p_list_id: listId, p_email: 'nobody@nowhere.test' });
  assert.match(error?.message ?? '', /No user found/);
});

// Realtime: bob subscribes, then alice changes the item.
const bobEvents = [];
const channel = bob.client
  .channel('test-items')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (p) => bobEvents.push(p));
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('realtime subscribe timeout')), 10000);
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      clearTimeout(t);
      resolve();
    }
  });
});

await test('owner shares by email (case-insensitive) and member sees list + items', async () => {
  await must(alice.client.rpc('share_list', { p_list_id: listId, p_email: 'BOB@Example.com' }));
  const lists = await must(bob.client.from('lists').select('id').eq('id', listId));
  assert.equal(lists.length, 1);
  const items = await must(bob.client.from('items').select('title').eq('list_id', listId));
  assert.deepEqual(items.map((i) => i.title), ['Milk']);
});

await test('members can see each other profiles; strangers cannot', async () => {
  const profiles = await must(bob.client.from('profiles').select('email').eq('id', alice.userId));
  assert.equal(profiles.length, 1);
  const hidden = await must(carol.client.from('profiles').select('email').eq('id', alice.userId));
  assert.equal(hidden.length, 0);
});

await test('shared member can check off and add items', async () => {
  await must(bob.client.from('items').update({ is_done: true }).eq('id', itemId));
  await must(bob.client.from('items').insert({ list_id: listId, title: 'Eggs' }));
  const items = await must(alice.client.from('items').select('title, is_done').eq('list_id', listId).order('created_at'));
  assert.deepEqual(items, [
    { title: 'Milk', is_done: true },
    { title: 'Eggs', is_done: false },
  ]);
});

await test('realtime: bob receives alice item changes', async () => {
  // Realtime needs a moment to pick up a membership that was added after the
  // subscription started (the app covers this gap by refetching on screen open).
  await new Promise((r) => setTimeout(r, 2000));
  bobEvents.length = 0;
  await must(alice.client.from('items').insert({ list_id: listId, title: 'Realtime item' }));
  const deadline = Date.now() + 8000;
  while (!bobEvents.some((e) => e.eventType === 'INSERT' && e.new.title === 'Realtime item') && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(
    bobEvents.some((e) => e.eventType === 'INSERT' && e.new.title === 'Realtime item'),
    'bob did not receive the INSERT event',
  );
});

await test('member cannot rename/delete the list or manage members', async () => {
  const renamed = await must(bob.client.from('lists').update({ name: 'hijacked' }).eq('id', listId).select());
  assert.equal(renamed.length, 0, 'rename by non-owner should affect 0 rows');
  const deleted = await must(bob.client.from('lists').delete().eq('id', listId).select());
  assert.equal(deleted.length, 0, 'delete by non-owner should affect 0 rows');
  const removedOwner = await must(
    bob.client.from('list_members').delete().eq('list_id', listId).eq('user_id', alice.userId).select(),
  );
  assert.equal(removedOwner.length, 0, 'owner membership must not be removable');
  const { error } = await bob.client.from('list_members').insert({ list_id: listId, user_id: carol.userId, role: 'editor' });
  assert.ok(error, 'direct member insert must be rejected');
});

await test('owner can clear completed items', async () => {
  await must(alice.client.from('items').delete().eq('list_id', listId).eq('is_done', true));
  const items = await must(alice.client.from('items').select('title').eq('list_id', listId));
  assert.ok(!items.some((i) => i.title === 'Milk'));
});

await test('member can leave; then loses access', async () => {
  await must(bob.client.from('list_members').delete().eq('list_id', listId).eq('user_id', bob.userId));
  const lists = await must(bob.client.from('lists').select('id').eq('id', listId));
  assert.equal(lists.length, 0);
});

await test('owner can remove a member', async () => {
  await must(alice.client.rpc('share_list', { p_list_id: listId, p_email: carolEmail }));
  assert.equal((await must(carol.client.from('lists').select('id').eq('id', listId))).length, 1);
  await must(alice.client.from('list_members').delete().eq('list_id', listId).eq('user_id', carol.userId));
  assert.equal((await must(carol.client.from('lists').select('id').eq('id', listId))).length, 0);
});

await test('owner can delete the list (items cascade)', async () => {
  await must(alice.client.from('lists').delete().eq('id', listId));
  const lists = await must(alice.client.from('lists').select('id').eq('id', listId));
  assert.equal(lists.length, 0);
});

await bob.client.removeChannel(channel);
console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
process.exit(process.exitCode ?? 0);
