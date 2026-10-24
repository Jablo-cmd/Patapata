begin;
\ir _helpers.psql
select plan(28);

select tests.create_member('alice');
select tests.create_member('bob');
select tests.create_member('carol');
select tests.create_member('mika');
select tests.create_member('bongi');
insert into public.staff_roles (user_id, role) values (tests.uid('mika'), 'moderator'), (tests.uid('bongi'), 'admin');
select tests.make_friends('alice', 'bob');
create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated;

select tests.authenticate_as('alice');
insert into ids select 'post', public.create_post('Buy followers cheap!!!', 'public');
insert into ids select 'conv', public.get_or_create_direct_conversation(tests.uid('bob'));
with m as (insert into public.messages (conversation_id, sender_id, body)
           values ((select id from ids where name = 'conv'), auth.uid(), 'threatening text') returning id)
insert into ids select 'msg', id from m;

-- ------------------------------------------------------------- staff gates
select throws_like($$ select public.admin_metrics() $$, 'staff_only%', 'members cannot read admin metrics');
select throws_like($$ select * from public.admin_list_reports() $$, 'staff_only%', 'members cannot read the report queue');
select throws_like(format($$ select public.admin_set_account_status(%L, 'suspended', 'x', now() + interval '1 day') $$, tests.uid('bob')),
  'staff_only%', 'members cannot suspend accounts');
select throws_ok(format($$ insert into public.staff_roles (user_id, role) values (%L, 'admin') $$, tests.uid('alice')),
  '42501', null, 'members cannot grant themselves staff roles');

-- --------------------------------------------------------------- reporting
select tests.authenticate_as('carol');
select throws_like(format($$ select public.create_report('message', %L, 'harassment') $$, (select id from ids where name = 'msg')),
  'target_not_found%', 'cannot report (or read) a message from someone else''s conversation');
select tests.authenticate_as('bob');
insert into ids select 'msg_report', public.create_report('message', (select id from ids where name = 'msg'), 'violence_threat', 'Scary');
select is(public.create_report('message', (select id from ids where name = 'msg'), 'violence_threat'),
          (select id from ids where name = 'msg_report'), 'duplicate open reports are merged');
select is((select count(*)::int from public.reports), 1, 'reporters see their own reports');
select tests.authenticate_as('carol');
insert into ids select 'post_report', public.create_report('post', (select id from ids where name = 'post'), 'spam');
select is((select count(*)::int from public.reports), 1, 'reporters cannot see others'' reports');

select tests.authenticate_as('mika');
select is((select priority from public.admin_list_reports() limit 1), 'urgent'::public.report_priority,
          'threats are prioritised at the top of the queue');
select is((public.admin_get_report((select id from ids where name = 'msg_report')) -> 'report' -> 'evidence' ->> 'body'),
          'threatening text', 'moderators see the reported message snapshot');
select is((select count(*)::int from public.messages), 0, 'moderators still cannot browse private conversations');
select ok((public.admin_metrics() ->> 'reports_open')::int = 2, 'metrics count open reports');

-- -------------------------------------------------- content moderation + appeal
insert into ids select 'remove_action',
  public.admin_moderate_content('post', (select id from ids where name = 'post'), true, 'Spam',
                                (select id from ids where name = 'post_report'));
select tests.authenticate_as('bob');
select is((select count(*)::int from public.posts where id = (select id from ids where name = 'post')), 0, 'removed post hidden');
select tests.authenticate_as('alice');
select is((select count(*)::int from public.notifications where type = 'moderation'), 1, 'author is told about the removal');
select is((select count(*)::int from public.moderation_actions), 1, 'author can see actions taken against them');
insert into ids select 'appeal', public.submit_appeal((select id from ids where name = 'remove_action'), 'This was a joke between friends.');
select tests.authenticate_as('mika');
select throws_like(format($$ select public.admin_decide_appeal(%L, true, 'ok') $$, (select id from ids where name = 'appeal')),
  'needs_independent_reviewer%', 'the acting moderator cannot decide the appeal');
select tests.authenticate_as('bongi');
select lives_ok(format($$ select public.admin_decide_appeal(%L, true, 'Context accepted') $$, (select id from ids where name = 'appeal')),
  'an independent reviewer decides the appeal');
reset role;
select is((select status from public.posts where id = (select id from ids where name = 'post')), 'active'::public.content_status,
          'overturned appeal restores content');

-- -------------------------------------------------------------- suspensions
select tests.authenticate_as('mika');
select throws_like(format($$ select public.admin_set_account_status(%L, 'banned', 'x') $$, tests.uid('alice')),
  'admin_only%', 'moderators cannot ban');
select throws_like(format($$ select public.admin_set_account_status(%L, 'suspended', 'x', now() + interval '1 day') $$, tests.uid('bongi')),
  'admin_only%', 'moderators cannot act on other staff');
select lives_ok(format($$ select public.admin_set_account_status(%L, 'suspended', 'Threats', now() + interval '7 days', %L) $$,
                       tests.uid('alice'), (select id from ids where name = 'msg_report')), 'moderator suspends');
select tests.authenticate_as('alice');
select throws_like($$ select public.create_post('I am back', 'public') $$, 'account_not_active%', 'suspended members cannot post');
select tests.authenticate_as('bob');
select is(public.get_profile('alice'), null, 'suspended profiles are hidden');
reset role;
update public.profiles set suspended_until = now() - interval '1 minute' where id = tests.uid('alice');
select ok(app.is_active(tests.uid('alice')), 'suspensions expire automatically');

-- ----------------------------------------------------- account deactivation
select tests.authenticate_as('carol');
select lives_ok($$ select public.deactivate_account(true) $$, 'request account deletion');
select ok((public.my_account_state() ->> 'deletion_scheduled_for') is not null, 'deletion date is scheduled');
select tests.authenticate_as('bob');
select is(public.get_profile('carol'), null, 'deactivated accounts are hidden immediately');
select tests.authenticate_as('carol');
select lives_ok($$ select public.reactivate_account() $$, 'member can cancel deletion during the grace period');

select * from finish();
rollback;
