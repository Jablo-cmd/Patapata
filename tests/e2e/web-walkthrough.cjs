// Browser walkthrough of the exported web app against a LOCAL Supabase stack.
// Usage (from the repo root, with `npx supabase start` and functions running):
//   npm run build:web && node tests/e2e/serve.cjs dist 8081 &
//   node tests/e2e/web-walkthrough.cjs [screenshotDir] [photo]
// Creates test users; never run against production.
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const SHOTS = process.argv[2] ?? 'tests/e2e/screenshots';
const PHOTO = process.argv[3] ?? 'tests/e2e/fixtures/sunset.jpg';
require('fs').mkdirSync(SHOTS, { recursive: true });
const env = Object.fromEntries(execSync('npx supabase status -o env', { encoding: 'utf8' })
  .split('\n').map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const run = Date.now().toString(36);
const email = `thandi.${run}@example.test`;
const password = 'sunny-days-2026';

async function emailCode(addr, after) {
  for (let i = 0; i < 60; i++) {
    const r = await (await fetch(`${env.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${addr}"`)}`)).json();
    const m = r.messages.find((x) => new Date(x.Created).getTime() >= after);
    if (m) { const msg = await (await fetch(`${env.MAILPIT_URL}/api/v1/message/${m.ID}`)).json(); const c = (msg.Text || msg.HTML).match(/\b(\d{6})\b/); if (c) return c[1]; }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('no code');
}

async function makeKofi() {
  const kEmail = `kofi.${run}@example.test`;
  const { data } = await service.auth.admin.createUser({ email: kEmail, password, email_confirm: true });
  const c = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email: kEmail, password });
  const r = await c.rpc('complete_onboarding', { p_username: `kofi_${run}`.slice(0, 30), p_display_name: 'Kofi Mensah', p_birth_date: '1994-03-02', p_country_code: 'GH', p_city: 'Accra', p_languages: ['en', 'ak'], p_interests: ['football', 'afrobeats', 'tech'], p_intents: ['friendship', 'networking'], p_accept_terms: true });
  if (r.error) throw r.error;
  await c.rpc('create_post', { p_body: 'Good morning from Accra! Who is watching the derby this weekend? ⚽', p_audience: 'public' });
  return { c, id: data.user.id };
}

let FAILPAGE; const errors = [];
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); FAILPAGE = page;
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
  const tid = (id) => page.locator(`[data-testid="${id}"]`);

  const kofi = await makeKofi();

  await page.goto('http://localhost:8081/');
  await tid('welcome-sign-up').waitFor();
  await shot('01-welcome');
  await tid('welcome-sign-up').click();
  await tid('sign-up-email').fill(email);
  await tid('sign-up-password').fill(password);
  await tid('sign-up-adult').click();
  const started = Date.now() - 2000;
  await tid('sign-up-submit').click();
  await tid('verify-code').waitFor();
  await shot('02-verify');
  await tid('verify-code').fill(await emailCode(email, started));
  await tid('verify-submit').click();

  await tid('onboarding-name').waitFor({ timeout: 15000 });
  await tid('onboarding-name').fill('Thandi Nkosi');
  await tid('onboarding-username').fill(`thandi_${run}`.slice(0, 30));
  await tid('dob-day').fill('14'); await tid('dob-month').fill('02'); await tid('dob-year').fill('1998');
  await page.getByText('Choose your country').click();
  await page.getByPlaceholder('Search').fill('South Af');
  await page.getByText('South Africa', { exact: false }).last().click();
  await page.getByText('Province / state / region (optional)').waitFor();
  await page.getByText('football', { exact: true }).click();
  await page.getByText('music', { exact: true }).click();
  await shot('03-onboarding');
  await tid('onboarding-agree').click({ position: { x: 12, y: 16 } });
  await tid('onboarding-submit').click();
  await page.getByText('Across Africa', { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  await shot('04-home-empty');

  // Explore feed shows Kofi's public post from Ghana.
  await page.getByText('Across Africa', { exact: true }).click();
  await page.getByText('Good morning from Accra').filter({ visible: true }).first().waitFor();
  await shot('05-explore');

  // Kofi sends a friend request; Thandi accepts it from notifications.
  const { data: me } = await service.from('profiles').select('id').eq('username', `thandi_${run}`.slice(0, 30)).single();
  await kofi.c.rpc('send_friend_request', { p_target: me.id });
  await page.reload();
  await tid('header-notifications').waitFor();
  await tid('header-notifications').click();
  await page.getByText('sent you a friend request').filter({ visible: true }).first().waitFor();
  await shot('06-notifications');
  await page.getByText('sent you a friend request').filter({ visible: true }).first().click();
  await page.getByText('Accept').filter({ visible: true }).first().click();
  await page.waitForTimeout(1000);
  await shot('07-friends-accepted');

  // Thandi posts to friends.
  await page.goto('http://localhost:8081/compose');
  await tid('compose-body').fill('Hello Patapata! Anyone in Joburg up for coffee on Saturday? @' + `kofi_${run}`.slice(0, 30));
  const chooser = page.waitForEvent('filechooser');
  await page.getByText('Add photos', { exact: true }).click();
  await (await chooser).setFiles(PHOTO);
  await page.getByLabel('Remove photo 1').waitFor();
  await shot('08-compose');
  await tid('compose-submit').click();
  await page.waitForTimeout(1500);
  await page.goto('http://localhost:8081/');
  await page.getByText('Anyone in Joburg up for coffee').filter({ visible: true }).first().waitFor();
  await page.locator('img[src*="post-media"]').filter({ visible: true }).first().waitFor({ timeout: 15000 });
  const uploaded = await service.storage.from('post-media').list(me.id);
  console.log('UPLOADED', JSON.stringify(uploaded.data.map((f) => [f.name, f.metadata.size, f.metadata.mimetype])));
  await page.waitForTimeout(1500);
  await shot('09-home-feed');

  // Kofi messages Thandi; she replies in real time.
  const conv = await kofi.c.rpc('get_or_create_direct_conversation', { p_other: me.id });
  await kofi.c.from('messages').insert({ conversation_id: conv.data, sender_id: kofi.id, body: 'Akwaaba! Count me in for coffee next time I visit Joburg.' });
  await page.goto('http://localhost:8081/messages');
  await page.getByText('Akwaaba').filter({ visible: true }).first().waitFor();
  await shot('10-messages');
  await page.getByText('Akwaaba').filter({ visible: true }).first().click();
  await tid('chat-input').fill('Deal! I know a great spot in Braamfontein.');
  await tid('chat-send').click();
  await page.waitForTimeout(800);
  const t0 = Date.now();
  await kofi.c.from('messages').insert({ conversation_id: conv.data, sender_id: kofi.id, body: 'Perfect 🙌' });
  await page.getByText('Perfect 🙌').filter({ visible: true }).first().waitFor({ timeout: 60000 });
  console.log('REALTIME LATENCY ms', Date.now() - t0);
  await shot('11-chat-realtime');

  await page.goto('http://localhost:8081/discover');
  await page.getByText('People across Africa', { exact: true }).filter({ visible: true }).first().waitFor();
  await page.waitForTimeout(800);
  await shot('12-discover');

  await page.goto('http://localhost:8081/meetups/new');
  await tid('meetup-title').fill('Coffee in Braamfontein');
  await tid('location-city').fill('Johannesburg');
  await tid('meetup-submit').click();
  await page.getByText('Venue to be agreed', { exact: false }).filter({ visible: true }).first().waitFor({ timeout: 10000 });
  await shot('13-meetup');

  await page.goto('http://localhost:8081/dating');
  await tid('dating-setup').waitFor();
  await shot('14-dating-intro');

  await page.goto('http://localhost:8081/profile');
  await page.getByText('Edit profile').filter({ visible: true }).first().waitFor();
  await page.waitForTimeout(800);
  await shot('15-profile');

  await page.goto('http://localhost:8081/settings');
  await page.getByText('Account & security').filter({ visible: true }).first().waitFor();
  await shot('16-settings');

  // Dark mode.
  const dark = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', storageState: await ctx.storageState() });
  const dp = await dark.newPage();
  await dp.goto('http://localhost:8081/');
  await dp.getByText('Anyone in Joburg up for coffee').filter({ visible: true }).first().waitFor();
  await dp.screenshot({ path: `${SHOTS}/17-home-dark.png` });

  // Desktop width.
  const wide = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: await ctx.storageState() });
  const wp = await wide.newPage();
  await wp.goto('http://localhost:8081/');
  await wp.getByText('Anyone in Joburg up for coffee').filter({ visible: true }).first().waitFor();
  await wp.screenshot({ path: `${SHOTS}/18-home-desktop.png` });

  console.log('CONSOLE ERRORS:', JSON.stringify(errors.filter((e) => !/favicon/.test(e)), null, 1));
  await browser.close();
})().catch(async (e) => { console.error('E2E FAILED', e.message.split('\n')[0]); console.error('ERRORS', JSON.stringify(errors)); if (FAILPAGE) { await FAILPAGE.screenshot({ path: `${SHOTS}/failure.png` }); console.error('URL', FAILPAGE.url()); } process.exit(1); });
