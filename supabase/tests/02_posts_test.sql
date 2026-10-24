begin;
\ir _helpers.psql
select plan(31);

select tests.create_member('alice');
select tests.create_member('bob');
select tests.create_member('carol');
select tests.create_member('mallory');
select tests.make_friends('alice', 'bob');

-- alice publishes posts with each audience
select tests.authenticate_as('alice');
create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated;
insert into ids select 'friends_post', public.create_post('Hello friends @bob', 'friends');
insert into ids select 'public_post', public.create_post('Hello Africa!', 'public');
insert into ids select 'private_post', public.create_post('Note to self', 'only_me');

select is((select count(*)::int from public.posts where author_id = auth.uid()), 3, 'author sees all own posts');

select tests.authenticate_as('bob');
select is((select array_agg(body order by body) from public.posts where author_id = tests.uid('alice')),
          '{"Hello Africa!","Hello friends @bob"}'::text[], 'friend sees public + friends posts, not private');
reset role;
select is((select count(*)::int from public.notifications where user_id = tests.uid('bob') and type = 'mention'), 1,
          'mentioned friend is notified');

select tests.authenticate_as('carol');
select is((select array_agg(body) from public.posts where author_id = tests.uid('alice')), '{"Hello Africa!"}'::text[], 'non-friend sees only public posts');
select is((select count(*)::int from public.get_feed('home')), 0, 'non-friend home feed excludes alice');
select is((select count(*)::int from public.get_feed('explore', p_limit => 50) where author_id = tests.uid('alice')), 1, 'explore feed shows public posts across Africa');
select is((select count(*)::int from public.get_feed('search', p_query => 'africa', p_limit => 50) where author_id = tests.uid('alice')), 1, 'post search works');
select is((select count(*)::int from public.get_feed('post', p_post => (select id from ids where name = 'friends_post'))), 0,
          'cannot fetch a friends-only post by id');

-- tampering attempts
update public.posts set body = 'pwned' where id = (select id from ids where name = 'public_post');
delete from public.posts where id = (select id from ids where name = 'public_post');
reset role;
select is((select body from public.posts where id = (select id from ids where name = 'public_post')), 'Hello Africa!',
          'others cannot edit or delete a post');

select tests.authenticate_as('carol');
select throws_ok(
  format($$ insert into public.comments (post_id, author_id, body) values (%L, auth.uid(), 'hi') $$,
         (select id from ids where name = 'friends_post')),
  '42501', null, 'cannot comment on a post you cannot see');
select throws_ok(
  format($$ insert into public.comments (post_id, author_id, body) values (%L, %L, 'impersonation') $$,
         (select id from ids where name = 'public_post'), tests.uid('bob')),
  '42501', null, 'cannot comment as someone else');
select throws_ok(
  format($$ insert into public.post_reactions (post_id, user_id) values (%L, auth.uid()) $$,
         (select id from ids where name = 'private_post')),
  '42501', null, 'cannot like a private post');

-- likes and comments
select lives_ok(
  format($$ insert into public.post_reactions (post_id, user_id) values (%L, auth.uid()) $$,
         (select id from ids where name = 'public_post')), 'can like a public post');
with c as (
  insert into public.comments (post_id, author_id, body)
  values ((select id from ids where name = 'public_post'), auth.uid(), 'Nice one') returning id
)
insert into ids select 'carol_comment', id from c;
reset role;
select is((select like_count from public.posts where id = (select id from ids where name = 'public_post')), 1, 'like counter');
select is((select comment_count from public.posts where id = (select id from ids where name = 'public_post')), 1, 'comment counter');
select is((select count(*)::int from public.notifications where user_id = tests.uid('alice') and type in ('post_like', 'post_comment')),
          2, 'author notified of like and comment');

-- post owner may remove comments on their own post
select tests.authenticate_as('alice');
delete from public.comments where id = (select id from ids where name = 'carol_comment');
reset role;
select is((select count(*)::int from public.comments where post_id = (select id from ids where name = 'public_post')), 0, 'post owner can delete comments on own post');

-- reshares
select tests.authenticate_as('bob');
select throws_like(format($$ select public.create_post('', 'public', '[]', %L) $$, (select id from ids where name = 'friends_post')),
  'post_not_shareable%', 'friends-only posts cannot be reshared');
select lives_ok(format($$ select public.create_post('Look at this', 'public', '[]', %L) $$, (select id from ids where name = 'public_post')),
  'public posts can be reshared');
reset role;
select is((select share_count from public.posts where id = (select id from ids where name = 'public_post')), 1, 'share counter');

-- idempotency, duplicates and rate limits
select tests.authenticate_as('bob');
select is(public.create_post('Once', 'friends', '[]', null, '11111111-1111-1111-1111-111111111111'),
          public.create_post('Once', 'friends', '[]', null, '11111111-1111-1111-1111-111111111111'),
          'retrying with the same client_request_id returns the same post');
select throws_like($$ select public.create_post('Once', 'friends') $$, 'duplicate_post%', 'duplicate text within 10 minutes is rejected');
select throws_like($$ select public.create_post('a'); select public.create_post('b'); select public.create_post('c'); select public.create_post('d') $$,
  'rate_limited%', 'posting burst is rate limited');

-- media: only your own uploaded files can be attached
select tests.fake_upload('post-media', tests.uid('alice') || '/photo-abcdefgh.jpg', 'alice');
select tests.authenticate_as('mallory');
select throws_like(format($$ select public.create_post('stolen', 'public', '[{"path":"%s/photo-abcdefgh.jpg"}]') $$, tests.uid('alice')),
  'invalid_media_path%', 'cannot attach another member''s upload');
select throws_like(format($$ select public.create_post('ghost', 'public', '[{"path":"%s/missing-abcdefgh.jpg"}]') $$, tests.uid('mallory')),
  'media_not_uploaded%', 'cannot attach files that were never uploaded');
select tests.authenticate_as('alice');
insert into ids select 'media_post',
  public.create_post('Pics', 'friends', format('[{"path":"%s/photo-abcdefgh.jpg","width":800,"height":600}]', tests.uid('alice'))::jsonb);
select tests.authenticate_as('bob');
select is((select count(*)::int from storage.objects where bucket_id = 'post-media' and name like tests.uid('alice') || '/%'), 1, 'friend can read media of a friends-only post');
select tests.authenticate_as('carol');
select is((select count(*)::int from storage.objects where bucket_id = 'post-media' and name like tests.uid('alice') || '/%'), 0, 'non-friend cannot read that media');
select is((select count(*)::int from public.post_media where owner_id = tests.uid('alice')), 0, 'non-friend cannot list that media');

-- blocks and moderation removals hide content
select tests.authenticate_as('alice');
insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), tests.uid('carol'));
select tests.authenticate_as('carol');
select is((select count(*)::int from public.posts where author_id = tests.uid('alice')), 0, 'blocked member cannot see public posts');
reset role;
update public.posts set status = 'removed' where id = (select id from ids where name = 'public_post');
select tests.authenticate_as('bob');
select is((select count(*)::int from public.posts where id = (select id from ids where name = 'public_post')), 0,
          'removed posts are hidden from others');
select tests.authenticate_as('alice');
select is((select count(*)::int from public.posts where id = (select id from ids where name = 'public_post')), 1,
          'authors still see their removed post');

select * from finish();
rollback;
