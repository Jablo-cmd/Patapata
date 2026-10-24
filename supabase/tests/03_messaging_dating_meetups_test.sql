begin;
\ir _helpers.psql
select plan(30);

select tests.create_member('alice');
select tests.create_member('bob');
select tests.create_member('carol');
select tests.create_member('dan', 'GH', '1980-01-01');
select tests.make_friends('alice', 'bob');
create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- ------------------------------------------------------------------ messaging
select tests.authenticate_as('alice');
insert into ids select 'ab', public.get_or_create_direct_conversation(tests.uid('bob'));
select is(public.get_or_create_direct_conversation(tests.uid('bob')), (select id from ids where name = 'ab'),
          'direct conversations are not duplicated');
insert into public.messages (conversation_id, sender_id, body) values ((select id from ids where name = 'ab'), auth.uid(), 'Sawubona!');

select tests.authenticate_as('bob');
select is((select unread_count from public.list_conversations() where id = (select id from ids where name = 'ab')), 1,
          'recipient sees unread count');
select is((select count(*)::int from public.notifications where type = 'message'), 1, 'recipient gets a message notification');
select lives_ok(format($$ select public.mark_conversation_read(%L) $$, (select id from ids where name = 'ab')), 'mark read');
select is((select unread_count from public.list_conversations() where id = (select id from ids where name = 'ab')), 0, 'unread cleared');

select tests.authenticate_as('carol');
select is((select count(*)::int from public.messages), 0, 'outsiders cannot read other conversations');
select is((select count(*)::int from public.conversation_members), 0, 'outsiders cannot list members');
select throws_ok(
  format($$ insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'intrude') $$,
         (select id from ids where name = 'ab')),
  '42501', null, 'outsiders cannot post into other conversations');
select throws_like(format($$ select public.get_or_create_direct_conversation(%L) $$, tests.uid('alice')),
  'messaging_not_allowed%', 'friends-only messaging setting is enforced');
reset role;
update public.user_privacy_settings set messages_from = 'everyone' where user_id = tests.uid('alice');
select tests.authenticate_as('carol');
select lives_ok(format($$ select public.get_or_create_direct_conversation(%L) $$, tests.uid('alice')),
  'members accepting messages from everyone can be messaged');

select tests.authenticate_as('bob');
select throws_like(
  format($$ select public.delete_message((select id from public.messages where conversation_id = %L limit 1)) $$,
         (select id from ids where name = 'ab')),
  'message_not_found%', 'only the sender can delete a message');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), tests.uid('alice'));
select tests.authenticate_as('alice');
select throws_ok(
  format($$ insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'still there?') $$,
         (select id from ids where name = 'ab')),
  '42501', null, 'blocked members cannot send messages');
reset role;
delete from public.blocks;

-- --------------------------------------------------------------------- dating
select tests.authenticate_as('alice');
select throws_like($$ select * from public.get_dating_candidates() $$, 'dating_not_enabled%', 'dating requires opt-in');
insert into public.dating_preferences (user_id, enabled, gender, interested_in, min_age, max_age)
values (auth.uid(), true, 'woman', '{man}', 25, 40);
select tests.authenticate_as('carol');
insert into public.dating_preferences (user_id, enabled, gender, interested_in) values (auth.uid(), true, 'man', '{woman}');
select tests.authenticate_as('dan');
insert into public.dating_preferences (user_id, enabled, gender, interested_in) values (auth.uid(), true, 'man', '{woman}');
-- bob has not opted in

select tests.authenticate_as('alice');
select is((select array_agg(username) from public.get_dating_candidates(50) where user_id in (select id from tests.users)), '{carol}'::text[],
          'only opted-in, mutually compatible members in age range are suggested');
select is((public.get_profile('carol') ->> 'open_to_dating')::boolean, false, 'dating is hidden on profiles by default');
select is(public.dating_respond(tests.uid('carol'), 'like'), false, 'one-sided like is not a match');
select throws_like(format($$ select public.dating_respond(%L, 'like') $$, tests.uid('bob')),
  'dating_candidate_unavailable%', 'cannot like members who are not in dating');

select tests.authenticate_as('carol');
select is((select count(*)::int from public.dating_swipes where target_id = auth.uid()), 0, 'likes received stay private');
select is((select count(*)::int from public.notifications where type = 'dating_match'), 0, 'no notification for a one-sided like');
select is(public.dating_respond(tests.uid('alice'), 'like'), true, 'mutual like creates a match');
select is((select count(*)::int from public.list_dating_matches()), 1, 'match is listed');
select ok((select (public.get_profile('alice') ->> 'can_message')::boolean), 'matched members may message');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), tests.uid('alice'));
select is((select count(*)::int from public.dating_matches), 0, 'blocking removes the match');

-- -------------------------------------------------------------------- meetups
reset role;
delete from public.blocks;
select tests.authenticate_as('alice');
with m as (
  insert into public.meetups (host_id, kind, title, category, country_code, city, venue_name, venue_address, starts_at, capacity)
  values (auth.uid(), 'event', 'Coffee in Braamfontein', 'coffee', 'ZA', 'Johannesburg', 'Daily Grind Cafe',
          '12 Juta Street', now() + interval '2 days', 2)
  returning id)
insert into ids select 'coffee', id from m;
with m as (
  insert into public.meetups (host_id, kind, title, country_code, city, audience)
  values (auth.uid(), 'chill', 'Friends-only braai', 'ZA', 'Johannesburg', 'friends') returning id)
insert into ids select 'braai', id from m;

select tests.authenticate_as('carol');
select throws_ok($$ select venue_name from public.meetups $$, '42501', null, 'venue columns are not directly selectable');
select is((select venue_name from public.list_meetups(p_meetup => (select id from ids where name = 'coffee'))), null,
          'venue hidden until attending');
select is((select count(*)::int from public.list_meetups(p_host => tests.uid('alice'))), 1, 'friends-only meetup hidden from non-friends');
select lives_ok(format($$ select public.respond_to_meetup(%L, 'going') $$, (select id from ids where name = 'coffee')), 'RSVP going');
select is((select venue_name from public.list_meetups(p_meetup => (select id from ids where name = 'coffee'))), 'Daily Grind Cafe',
          'venue revealed to attendees');

select tests.authenticate_as('dan');
select throws_like(format($$ select public.respond_to_meetup(%L, 'going') $$, (select id from ids where name = 'coffee')),
  'meetup_full%', 'capacity is enforced');

select tests.authenticate_as('alice');
select throws_ok(format($$ update public.meetups set status = 'removed' where id = %L $$, (select id from ids where name = 'coffee')),
  '42501', null, 'hosts cannot apply moderator removal');

select * from finish();
rollback;
