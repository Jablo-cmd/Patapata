import { describe, expect, it } from 'vitest';

import {
  anonClient,
  createMember,
  emailCode,
  makeFriends,
  PASSWORD,
  service,
  SERVICE_KEY,
  API_URL,
  sleep,
  TINY_JPEG,
  uniqueEmail,
  uniqueUsername,
} from './helpers';

describe('sign-up, verification and onboarding', () => {
  it('verifies email with the emailed code, enforces 18+, and onboards', async () => {
    const client = anonClient();
    const email = uniqueEmail('newbie');
    const started = Date.now() - 1000;

    const signUp = await client.auth.signUp({ email, password: PASSWORD });
    expect(signUp.error).toBeNull();
    expect(signUp.data.session).toBeNull(); // email confirmation required

    const early = await client.auth.signInWithPassword({ email, password: PASSWORD });
    expect(early.error?.code).toBe('email_not_confirmed');

    const code = await emailCode(email, started);
    const verified = await client.auth.verifyOtp({ email, token: code, type: 'signup' });
    expect(verified.error).toBeNull();
    expect(verified.data.session).not.toBeNull();

    const state = await client.rpc('my_account_state');
    expect((state.data as { status: string }).status).toBe('pending');

    // Members cannot use the app before onboarding.
    const post = await client.rpc('create_post', { p_body: 'hi' });
    expect(post.error?.message).toMatch(/account_not_active/);

    const onboard = await client.rpc('complete_onboarding', {
      p_username: uniqueUsername('newbie'),
      p_display_name: 'New Member',
      p_birth_date: '1999-02-03',
      p_country_code: 'NG',
      p_accept_terms: true,
    });
    expect(onboard.error).toBeNull();
    expect(onboard.data).toBe('ok');
    const after = await client.rpc('my_account_state');
    expect((after.data as { status: string }).status).toBe('active');
  });

  it('rejects weak passwords', async () => {
    const { error } = await anonClient().auth.signUp({ email: uniqueEmail('weak'), password: 'short' });
    expect(error?.code).toBe('weak_password');
  });

  it('resets a password with the emailed recovery code', async () => {
    const m = await createMember('forgetful');
    const client = anonClient();
    const started = Date.now() - 1000;
    expect((await client.auth.resetPasswordForEmail(m.email)).error).toBeNull();
    const code = await emailCode(m.email, started);
    expect((await client.auth.verifyOtp({ email: m.email, token: code, type: 'recovery' })).error).toBeNull();
    expect((await client.auth.updateUser({ password: 'brand-new-pass-77' })).error).toBeNull();
    const again = await anonClient().auth.signInWithPassword({ email: m.email, password: 'brand-new-pass-77' });
    expect(again.error).toBeNull();
    // A security notification records the change.
    const notes = await client.from('notifications').select('type, data').eq('type', 'security');
    expect(notes.data?.[0]?.data).toMatchObject({ event: 'password_changed' });
  });
});

describe('posts and private media', () => {
  it('lets friends (and only friends) open photos on friends-only posts', async () => {
    const alice = await createMember('amara');
    const bob = await createMember('bayo');
    const carol = await createMember('chipo');
    await makeFriends(alice, bob);

    const path = `${alice.id}/photo${Date.now()}.jpg`;
    const upload = await alice.client.storage.from('post-media').upload(path, TINY_JPEG, { contentType: 'image/jpeg' });
    expect(upload.error).toBeNull();

    // Nobody can upload into someone else's folder.
    const sneaky = await carol.client.storage.from('post-media').upload(`${alice.id}/fake${Date.now()}.jpg`, TINY_JPEG, { contentType: 'image/jpeg' });
    expect(sneaky.error).not.toBeNull();

    const created = await alice.client.rpc('create_post', {
      p_body: 'Sunset in Soweto',
      p_audience: 'friends',
      p_media: [{ path, width: 1, height: 1 }],
      p_client_request_id: crypto.randomUUID(),
    });
    expect(created.error).toBeNull();

    const friendUrl = await bob.client.storage.from('post-media').createSignedUrl(path, 60);
    expect(friendUrl.error).toBeNull();
    const img = await fetch(friendUrl.data!.signedUrl);
    expect(img.status).toBe(200);

    const strangerUrl = await carol.client.storage.from('post-media').createSignedUrl(path, 60);
    expect(strangerUrl.error).not.toBeNull();

    const feed = await bob.client.rpc('get_feed', { p_scope: 'home' });
    expect(feed.data?.some((p) => p.id === created.data)).toBe(true);
    const strangerFeed = await carol.client.rpc('get_feed', { p_scope: 'user', p_user: alice.id });
    expect(strangerFeed.data?.length).toBe(0);
  });

  it('rejects uploads that are not images or are too large', async () => {
    const m = await createMember('uploader');
    const html = await m.client.storage
      .from('post-media')
      .upload(`${m.id}/page${Date.now()}.jpg`, Buffer.from('<script>alert(1)</script>'), { contentType: 'text/html' });
    expect(html.error).not.toBeNull();
    const big = await m.client.storage
      .from('post-media')
      .upload(`${m.id}/big${Date.now()}.jpg`, Buffer.alloc(6 * 1024 * 1024), { contentType: 'image/jpeg' });
    expect(big.error).not.toBeNull();
  });

  it('cleans up the files of deleted posts', async () => {
    const m = await createMember('tidy');
    const path = `${m.id}/gone${Date.now()}.jpg`;
    await m.client.storage.from('post-media').upload(path, TINY_JPEG, { contentType: 'image/jpeg' });
    const post = await m.client.rpc('create_post', { p_body: 'temporary', p_media: [{ path }] });
    expect(post.error).toBeNull();
    expect((await m.client.from('posts').delete().eq('id', post.data!)).error).toBeNull();

    const res = await fetch(`${API_URL}/functions/v1/cleanup-storage`, { method: 'POST', headers: { Authorization: `Bearer ${SERVICE_KEY}` } });
    expect(res.status).toBe(200);
    const list = await service.storage.from('post-media').list(m.id);
    expect(list.data?.find((f) => path.endsWith(f.name))).toBeUndefined();

    const forbidden = await fetch(`${API_URL}/functions/v1/cleanup-storage`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${(await m.client.auth.getSession()).data.session!.access_token}` },
    });
    expect(forbidden.status).toBe(403);
  });
});

describe('messaging', () => {
  it('delivers messages in realtime to members only', async () => {
    const alice = await createMember('adaeze');
    const bob = await createMember('baraka');
    const eve = await createMember('eve');
    await makeFriends(alice, bob);

    const conv = await alice.client.rpc('get_or_create_direct_conversation', { p_other: bob.id });
    expect(conv.error).toBeNull();
    const conversationId = conv.data!;

    const received: string[] = [];
    const leaked: string[] = [];
    const subscribe = async (client: typeof bob.client, sink: string[]) => {
      const token = (await client.auth.getSession()).data.session!.access_token;
      client.realtime.setAuth(token);
      return new Promise<ReturnType<typeof client.channel>>((resolve) => {
        const ch = client
          .channel(`test:${conversationId}:${Math.random()}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (p) =>
            sink.push((p.new as { body: string }).body),
          )
          .subscribe((status) => status === 'SUBSCRIBED' && resolve(ch));
      });
    };
    const bobChannel = await subscribe(bob.client, received);
    const eveChannel = await subscribe(eve.client, leaked);
    await sleep(1500);

    const sent = await alice.client.from('messages').insert({ conversation_id: conversationId, sender_id: alice.id, body: 'Habari!' });
    expect(sent.error).toBeNull();
    for (let i = 0; i < 40 && received.length === 0; i++) await sleep(250);
    expect(received).toContain('Habari!');
    expect(leaked).toHaveLength(0);

    const eveRead = await eve.client.from('messages').select('id').eq('conversation_id', conversationId);
    expect(eveRead.data).toEqual([]);

    const list = await bob.client.rpc('list_conversations');
    expect(list.data?.find((c) => c.id === conversationId)?.unread_count).toBe(1);

    await bob.client.removeChannel(bobChannel);
    await eve.client.removeChannel(eveChannel);
  });

  it('blocks messages from strangers unless the member allows it', async () => {
    const alice = await createMember('akosua');
    const stranger = await createMember('stranger');
    const denied = await stranger.client.rpc('get_or_create_direct_conversation', { p_other: alice.id });
    expect(denied.error?.message).toMatch(/messaging_not_allowed/);
  });
});

describe('meetups and dating', () => {
  it('hides the venue until a member says they are going', async () => {
    const host = await createMember('host');
    const guest = await createMember('guest');
    const created = await host.client
      .from('meetups')
      .insert({
        host_id: host.id,
        kind: 'event',
        title: 'Football at the fan park',
        category: 'football',
        country_code: 'ZA',
        city: 'Durban',
        venue_name: 'Fan Park',
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select('id')
      .single();
    expect(created.error).toBeNull();
    const id = created.data!.id;

    const before = await guest.client.rpc('list_meetups', { p_meetup: id });
    expect(before.data?.[0].venue_name).toBeNull();
    expect(before.data?.[0].venue_hidden).toBe(true);
    expect((await guest.client.rpc('respond_to_meetup', { p_meetup: id, p_status: 'going' })).error).toBeNull();
    const after = await guest.client.rpc('list_meetups', { p_meetup: id });
    expect(after.data?.[0].venue_name).toBe('Fan Park');

    const hostNotes = await host.client.from('notifications').select('type').eq('type', 'meetup_response');
    expect(hostNotes.data?.length).toBe(1);
  });

  it('only matches opted-in adults who like each other, and lets matches chat', async () => {
    const a = await createMember('dee', { country: 'KE' });
    const b = await createMember('sam', { country: 'GH' });
    for (const [m, gender, wants] of [
      [a, 'woman', 'man'],
      [b, 'man', 'woman'],
    ] as const) {
      const { error } = await m.client.from('dating_preferences').insert({ user_id: m.id, enabled: true, gender, interested_in: [wants] });
      expect(error).toBeNull();
    }
    // Cross-border by default: Kenya ↔ Ghana.
    const candidates = await a.client.rpc('get_dating_candidates');
    expect(candidates.data?.some((c) => c.user_id === b.id)).toBe(true);
    expect((await a.client.rpc('dating_respond', { p_target: b.id, p_decision: 'like' })).data).toBe(false);
    expect((await b.client.rpc('dating_respond', { p_target: a.id, p_decision: 'like' })).data).toBe(true);
    const conv = await b.client.rpc('get_or_create_direct_conversation', { p_other: a.id });
    expect(conv.error).toBeNull();
  });
});

describe('moderation and account deletion', () => {
  it('keeps admin tools behind the staff role', async () => {
    const member = await createMember('curious');
    const denied = await member.client.rpc('admin_metrics');
    expect(denied.error?.message).toMatch(/staff_only/);

    const mod = await createMember('mod_team');
    expect((await service.from('staff_roles').insert({ user_id: mod.id, role: 'moderator' })).error).toBeNull();
    const metrics = await mod.client.rpc('admin_metrics');
    expect(metrics.error).toBeNull();
  });

  it('purges an account and its files after the grace period', async () => {
    const m = await createMember('leaving');
    const friend = await createMember('stayer');
    await makeFriends(m, friend);
    const avatar = `${m.id}/avatar${Date.now()}.jpg`;
    await m.client.storage.from('avatars').upload(avatar, TINY_JPEG, { contentType: 'image/jpeg' });
    await m.client.from('profiles').update({ avatar_path: avatar }).eq('id', m.id);
    await m.client.rpc('create_post', { p_body: 'Goodbye for now', p_audience: 'public' });

    expect((await m.client.rpc('deactivate_account', { p_delete: true })).error).toBeNull();
    const hidden = await friend.client.rpc('get_profile', { p_user_id: m.id });
    expect(hidden.data).toBeNull();

    // Simulate the 14-day grace period passing.
    await service.from('profiles').update({ deletion_requested_at: new Date(Date.now() - 15 * 86_400_000).toISOString() }).eq('id', m.id);
    const res = await fetch(`${API_URL}/functions/v1/purge-deleted-accounts`, { method: 'POST', headers: { Authorization: `Bearer ${SERVICE_KEY}` } });
    const body = (await res.json()) as { results: { id: string; ok: boolean; error?: string }[] };
    expect(res.status).toBe(200);
    expect(body.results.find((r) => r.id === m.id)).toMatchObject({ ok: true });

    const user = await service.auth.admin.getUserById(m.id);
    expect(user.data.user).toBeNull();
    const rows = await service.from('posts').select('id').eq('author_id', m.id);
    expect(rows.data).toEqual([]);
    const files = await service.storage.from('avatars').list(m.id);
    expect(files.data).toEqual([]);
    const friendships = await friend.client.from('friendships').select('id');
    expect(friendships.data).toEqual([]);
  });
});
