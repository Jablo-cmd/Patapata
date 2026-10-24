begin;
\ir _helpers.psql
select plan(35);

select tests.create_member('alice');
select tests.create_member('bob');
select tests.create_member('carol', 'KE');
select tests.create_user('dave', false);   -- unconfirmed email
select tests.create_user('eve');           -- will fail the age gate
select tests.create_user('frank');

-- ---------------------------------------------------------------- onboarding
select tests.authenticate_as('dave');
select throws_like(
  $$ select public.complete_onboarding('dave', 'Dave', '1990-01-01', 'ZA', null, null, '{}', '{}', '{friendship}', true) $$,
  'email_not_verified%', 'unverified email cannot onboard');

select tests.authenticate_as('eve');
select is(public.complete_onboarding('eve', 'Eve', (now() - interval '17 years')::date, 'ZA', null, null,
                                     '{}', '{}', '{friendship}', true),
          'age_ineligible', 'under-18 cannot onboard');
select is((select status from public.profiles where id = auth.uid()), 'pending'::public.account_status,
          'under-18 account stays pending');
select throws_like(
  $$ select public.complete_onboarding('eve', 'Eve', '1990-01-01', 'ZA', null, null, '{}', '{}', '{friendship}', true) $$,
  'age_ineligible%', 'age gate cannot be retried with a different birth date');

select tests.authenticate_as('frank');
select throws_like(
  $$ select public.complete_onboarding('admin', 'Frank', '1990-01-01', 'ZA', null, null, '{}', '{}', '{friendship}', true) $$,
  'username_unavailable%', 'reserved usernames are rejected');
select throws_like(
  $$ select public.complete_onboarding('alice', 'Frank', '1990-01-01', 'ZA', null, null, '{}', '{}', '{friendship}', true) $$,
  'username_unavailable%', 'taken usernames are rejected');
select throws_like(
  $$ select public.complete_onboarding('frank', 'Frank', '1990-01-01', 'ZA', null, null, '{}', '{}', '{friendship}', false) $$,
  'terms_not_accepted%', 'terms must be accepted');
select lives_ok(
  $$ select public.complete_onboarding('frank', 'Frank', '1990-01-01', 'NG', 'Lagos', 'Ikeja', '{en,yo}', '{Football, football,  Jollof }', '{friendship}', true) $$,
  'valid onboarding succeeds');
reset role;
select is((select interests from public.profiles where id = tests.uid('frank')), '{football,jollof}'::text[],
  'interests are normalised and de-duplicated');

-- -------------------------------------------------------- column privacy
select tests.authenticate_as('bob');
select throws_ok($$ select bio from public.profiles $$, '42501', null, 'bio is not directly selectable');
select throws_ok($$ select last_active_at from public.profiles $$, '42501', null, 'activity time is not selectable');
select is((select count(*)::int from public.profile_private where user_id = tests.uid('alice')), 0,
  'others cannot read a birth date');
select isnt_empty($$ select username from public.profiles where id = tests.uid('alice') $$,
  'profile cards are visible to members');

select tests.authenticate_as('alice');
select is((select count(*)::int from public.profile_private), 1, 'members read only their own private row');
select throws_ok($$ update public.profiles set status = 'active' where id = auth.uid() $$, '42501', null,
  'members cannot change their own account status');

-- bob tries to edit alice's profile and privacy settings: no rows touched
select tests.authenticate_as('bob');
update public.profiles set display_name = 'Hacked' where id = tests.uid('alice');
update public.user_privacy_settings set discoverable = false where user_id = tests.uid('alice');
reset role;
select is((select display_name from public.profiles where id = tests.uid('alice')), 'Alice',
  'cannot edit another profile');
select is((select discoverable from public.user_privacy_settings where user_id = tests.uid('alice')), true,
  'cannot edit another member''s privacy settings');

-- ------------------------------------------------------------- friendships
select tests.authenticate_as('alice');
select is(public.send_friend_request(tests.uid('bob')), 'pending'::public.friendship_status, 'friend request sent');
select is(public.send_friend_request(tests.uid('bob')), 'pending'::public.friendship_status, 'duplicate request is idempotent');
select throws_like($$ select public.send_friend_request(auth.uid()) $$, 'cannot_friend_self%', 'no self-friendship');
select throws_ok(
  format($$ insert into public.friendships (requester_id, addressee_id, status) values (auth.uid(), %L, 'accepted') $$, tests.uid('carol')),
  '42501', null, 'friendship rows cannot be forged directly');

select tests.authenticate_as('carol');
select is((select count(*)::int from public.friendships), 0, 'outsiders cannot see others'' friendship rows');
select throws_like(format($$ select public.respond_friend_request(%L, true) $$, tests.uid('alice')),
  'request_not_found%', 'outsiders cannot accept someone else''s request');

select tests.authenticate_as('bob');
select lives_ok(format($$ select public.respond_friend_request(%L, true) $$, tests.uid('alice')), 'addressee accepts');
reset role;
select ok(app.are_friends(tests.uid('alice'), tests.uid('bob')), 'alice and bob are friends');
select is((select count(*)::int from public.notifications where user_id = tests.uid('alice') and type = 'friend_accepted'), 1,
  'requester is notified of acceptance');

update public.user_privacy_settings set friend_requests_from = 'nobody' where user_id = tests.uid('carol');
select tests.authenticate_as('alice');
select throws_like(format($$ select public.send_friend_request(%L) $$, tests.uid('carol')),
  'friend_requests_disabled%', 'friend-request privacy setting is enforced');

-- ------------------------------------------------------- profile privacy
reset role;
update public.user_privacy_settings set profile_visibility = 'friends', friends_list_visibility = 'only_me'
 where user_id = tests.uid('alice');
update public.profiles set bio = 'Secret bio' where id = tests.uid('alice');
select tests.authenticate_as('carol');
select is(public.get_profile('alice') ->> 'bio', null, 'friends-only profile hides bio from non-friends');
select is((select count(*)::int from public.list_friends(tests.uid('alice'))), 0, 'hidden friends list returns nothing');
select tests.authenticate_as('bob');
select is(public.get_profile('alice') ->> 'bio', 'Secret bio', 'friends see friends-only profile content');

-- ----------------------------------------------------------------- blocking
select tests.authenticate_as('bob');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), tests.uid('alice'));
reset role;
select ok(not app.are_friends(tests.uid('alice'), tests.uid('bob')), 'blocking removes the friendship');
select tests.authenticate_as('alice');
select is((select count(*)::int from public.profiles where id = tests.uid('bob')), 0, 'blocked members cannot see the blocker');
select is(public.get_profile('bob'), null, 'get_profile returns nothing across a block');
select throws_like(format($$ select public.send_friend_request(%L) $$, tests.uid('bob')),
  'user_unavailable%', 'cannot send requests across a block');

select tests.authenticate_anon();
select throws_ok($$ select id from public.profiles $$, '42501', null, 'anonymous users cannot read profiles');

select * from finish();
rollback;
