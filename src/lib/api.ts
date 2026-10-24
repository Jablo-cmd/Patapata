/**
 * Typed data access. Every call runs as the signed-in member; permissions are
 * enforced by Row Level Security and SECURITY DEFINER RPCs in the database.
 */
import { uuid } from './ids';
import { supabase } from './supabase';
import type {
  AccountState,
  CommentRow,
  Conversation,
  DatingCandidate,
  DatingGender,
  DatingGoal,
  DatingPreferences,
  DiscoverResult,
  FeedPost,
  FriendRequestRow,
  Meetup,
  MeetupCategory,
  MeetupResponse,
  MessageRow,
  NotificationPreferences,
  NotificationRow,
  PersonCard,
  PostAudience,
  PrivacySettings,
  ProfileView,
  ReportReason,
  ReportTarget,
  SocialIntent,
} from './types';

const CARD = 'id, username, display_name, avatar_path, country_code';

function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data as T;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('not_authenticated');
  return id;
}

// ---------------------------------------------------------------- account

export async function getAccountState(): Promise<AccountState | null> {
  return unwrap(await supabase.rpc('my_account_state')) as AccountState | null;
}

export type OnboardingInput = {
  username: string;
  displayName: string;
  birthDate: string;
  countryCode: string;
  region?: string | null;
  city?: string | null;
  languages: string[];
  interests: string[];
  intents: SocialIntent[];
  acceptTerms: boolean;
  termsVersion: string;
};

export async function completeOnboarding(input: OnboardingInput): Promise<'ok' | 'age_ineligible'> {
  return unwrap(
    await supabase.rpc('complete_onboarding', {
      p_username: input.username,
      p_display_name: input.displayName,
      p_birth_date: input.birthDate,
      p_country_code: input.countryCode,
      p_region: input.region ?? undefined,
      p_city: input.city ?? undefined,
      p_languages: input.languages,
      p_interests: input.interests,
      p_intents: input.intents,
      p_accept_terms: input.acceptTerms,
      p_terms_version: input.termsVersion,
    }),
  ) as 'ok' | 'age_ineligible';
}

export async function usernameAvailable(username: string): Promise<boolean> {
  return unwrap(await supabase.rpc('username_available', { p_username: username })) === true;
}

export async function deactivateAccount(deletePermanently: boolean) {
  unwrap(await supabase.rpc('deactivate_account', { p_delete: deletePermanently }));
}

export async function reactivateAccount() {
  unwrap(await supabase.rpc('reactivate_account'));
}

export async function touchLastActive() {
  await supabase.rpc('touch_last_active');
}

// ---------------------------------------------------------------- reference data

export async function listCountries() {
  return unwrap(await supabase.from('countries').select('*').eq('is_enabled', true).order('name'));
}

export async function listRegions(countryCode: string) {
  return unwrap(await supabase.from('regions').select('id, name').eq('country_code', countryCode).order('name'));
}

// ---------------------------------------------------------------- profiles

export async function getProfile(by: { username?: string; userId?: string }): Promise<ProfileView | null> {
  return unwrap(
    await supabase.rpc('get_profile', { p_username: by.username, p_user_id: by.userId }),
  ) as ProfileView | null;
}

export async function getMyProfile(): Promise<ProfileView | null> {
  return getProfile({ userId: await currentUserId() });
}

export type ProfileUpdate = Partial<{
  display_name: string;
  bio: string;
  avatar_path: string | null;
  cover_path: string | null;
  country_code: string;
  region: string | null;
  city: string | null;
  languages: string[];
  interests: string[];
  hobbies: string[];
  intents: SocialIntent[];
}>;

export async function updateMyProfile(update: ProfileUpdate) {
  const id = await currentUserId();
  unwrap(await supabase.from('profiles').update(update).eq('id', id));
}

export async function changeUsername(username: string) {
  unwrap(await supabase.rpc('change_username', { p_username: username }));
}

export async function getPrivacySettings(): Promise<PrivacySettings> {
  return unwrap(await supabase.from('user_privacy_settings').select('*').single()) as PrivacySettings;
}

export async function updatePrivacySettings(
  update: Partial<Omit<PrivacySettings, 'user_id' | 'updated_at' | 'location_enabled'>>,
) {
  const id = await currentUserId();
  unwrap(await supabase.from('user_privacy_settings').update(update).eq('user_id', id));
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return unwrap(await supabase.from('notification_preferences').select('*').single()) as NotificationPreferences;
}

export async function updateNotificationPreferences(
  update: Partial<Omit<NotificationPreferences, 'user_id' | 'updated_at'>>,
) {
  const id = await currentUserId();
  unwrap(await supabase.from('notification_preferences').update(update).eq('user_id', id));
}

export async function setApproximateLocation(lat: number, lng: number) {
  unwrap(await supabase.rpc('set_approximate_location', { p_lat: lat, p_lng: lng }));
}

export async function clearLocation() {
  unwrap(await supabase.rpc('clear_location'));
}

// ---------------------------------------------------------------- friends & blocks

export async function sendFriendRequest(userId: string) {
  return unwrap(await supabase.rpc('send_friend_request', { p_target: userId }));
}

export async function respondFriendRequest(requesterId: string, accept: boolean) {
  unwrap(await supabase.rpc('respond_friend_request', { p_requester: requesterId, p_accept: accept }));
}

export async function cancelFriendRequest(userId: string) {
  unwrap(await supabase.rpc('cancel_friend_request', { p_target: userId }));
}

export async function removeFriend(userId: string) {
  unwrap(await supabase.rpc('remove_friend', { p_target: userId }));
}

export async function listFriends(userId: string, offset = 0) {
  return unwrap(await supabase.rpc('list_friends', { p_user: userId, p_limit: 50, p_offset: offset }));
}

export async function listFriendRequests(): Promise<FriendRequestRow[]> {
  const rows = unwrap(
    await supabase
      .from('friendships')
      .select(
        `id, requester_id, addressee_id, status, created_at,
         requester:profiles!friendships_requester_id_fkey(${CARD}),
         addressee:profiles!friendships_addressee_id_fkey(${CARD})`,
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100),
  );
  return rows as unknown as FriendRequestRow[];
}

export async function blockUser(userId: string) {
  const me = await currentUserId();
  const { error } = await supabase.from('blocks').insert({ blocker_id: me, blocked_id: userId });
  if (error && error.code !== '23505') throw error;
}

export async function unblockUser(userId: string) {
  const me = await currentUserId();
  unwrap(await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', userId));
}

export async function listBlockedUsers() {
  return unwrap(await supabase.rpc('list_blocked_users'));
}

// ---------------------------------------------------------------- posts

export type FeedScope = 'home' | 'explore' | 'user' | 'post' | 'search';
export type FeedCursor = { before: string; beforeId: string } | null;

export async function getFeed(
  scope: FeedScope,
  opts: { userId?: string; postId?: string; country?: string; query?: string; cursor?: FeedCursor; limit?: number } = {},
): Promise<FeedPost[]> {
  const rows = unwrap(
    await supabase.rpc('get_feed', {
      p_scope: scope,
      p_user: opts.userId,
      p_post: opts.postId,
      p_country: opts.country,
      p_query: opts.query,
      p_before: opts.cursor?.before,
      p_before_id: opts.cursor?.beforeId,
      p_limit: opts.limit ?? 15,
    }),
  );
  return rows as unknown as FeedPost[];
}

export async function getPost(postId: string): Promise<FeedPost | null> {
  const rows = await getFeed('post', { postId, limit: 1 });
  return rows[0] ?? null;
}

export async function createPost(input: {
  body: string;
  audience: PostAudience;
  media?: { path: string; width: number; height: number }[];
  sharedPostId?: string;
  clientRequestId: string;
}): Promise<string> {
  return unwrap(
    await supabase.rpc('create_post', {
      p_body: input.body,
      p_audience: input.audience,
      p_media: input.media ?? [],
      p_shared_post_id: input.sharedPostId,
      p_client_request_id: input.clientRequestId,
    }),
  );
}

export async function updatePost(postId: string, update: { body?: string; audience?: PostAudience }) {
  unwrap(await supabase.from('posts').update(update).eq('id', postId));
}

export async function deletePost(postId: string) {
  unwrap(await supabase.from('posts').delete().eq('id', postId));
}

export async function setLike(postId: string, liked: boolean) {
  const me = await currentUserId();
  if (liked) {
    const { error } = await supabase.from('post_reactions').insert({ post_id: postId, user_id: me });
    if (error && error.code !== '23505') throw error;
  } else {
    unwrap(await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', me));
  }
}

export async function listComments(postId: string): Promise<CommentRow[]> {
  const rows = unwrap(
    await supabase
      .from('comments')
      .select(
        `id, post_id, author_id, parent_id, body, status, reply_count, edited_at, created_at,
         author:profiles!comments_author_id_fkey(${CARD})`,
      )
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(300),
  );
  return rows as unknown as CommentRow[];
}

export async function addComment(postId: string, body: string, parentId?: string | null) {
  const me = await currentUserId();
  unwrap(
    await supabase.from('comments').insert({ post_id: postId, author_id: me, body, parent_id: parentId ?? null }),
  );
}

export async function updateComment(commentId: string, body: string) {
  unwrap(await supabase.from('comments').update({ body }).eq('id', commentId));
}

export async function deleteComment(commentId: string) {
  unwrap(await supabase.from('comments').delete().eq('id', commentId));
}

// ---------------------------------------------------------------- discovery

export type DiscoverFilters = {
  country?: string | null;
  region?: string | null;
  city?: string | null;
  interests?: string[];
  languages?: string[];
  minAge?: number | null;
  maxAge?: number | null;
  intent?: SocialIntent | null;
  maxDistanceKm?: number | null;
  query?: string | null;
};

export async function discoverPeople(filters: DiscoverFilters, offset = 0): Promise<DiscoverResult[]> {
  return unwrap(
    await supabase.rpc('discover_people', {
      p_country: filters.country ?? undefined,
      p_region: filters.region || undefined,
      p_city: filters.city || undefined,
      p_interests: filters.interests?.length ? filters.interests : undefined,
      p_languages: filters.languages?.length ? filters.languages : undefined,
      p_min_age: filters.minAge ?? undefined,
      p_max_age: filters.maxAge ?? undefined,
      p_intent: filters.intent ?? undefined,
      p_max_distance_km: filters.maxDistanceKm ?? undefined,
      p_query: filters.query || undefined,
      p_limit: 20,
      p_offset: offset,
    }),
  );
}

export async function suggestPeople(limit = 10) {
  return unwrap(await supabase.rpc('suggest_people', { p_limit: limit }));
}

// ---------------------------------------------------------------- messaging

export async function getOrCreateConversation(userId: string): Promise<string> {
  return unwrap(await supabase.rpc('get_or_create_direct_conversation', { p_other: userId }));
}

export async function listConversations(): Promise<Conversation[]> {
  return unwrap(await supabase.rpc('list_conversations', { p_limit: 50 }));
}

export async function getConversationMembers(conversationId: string) {
  const rows = unwrap(
    await supabase
      .from('conversation_members')
      .select(`user_id, last_read_at, profile:profiles!conversation_members_user_id_fkey(${CARD})`)
      .eq('conversation_id', conversationId),
  );
  return rows as unknown as { user_id: string; last_read_at: string; profile: PersonCard | null }[];
}

export async function listMessages(conversationId: string, before?: string): Promise<MessageRow[]> {
  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, attachment_path, deleted_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (before) query = query.lt('created_at', before);
  return unwrap(await query);
}

export async function sendMessage(input: {
  conversationId: string;
  body: string;
  attachmentPath?: string | null;
  clientRequestId?: string;
}) {
  const me = await currentUserId();
  const { error } = await supabase.from('messages').insert({
    conversation_id: input.conversationId,
    sender_id: me,
    body: input.body,
    attachment_path: input.attachmentPath ?? null,
    client_request_id: input.clientRequestId ?? uuid(),
  });
  // A unique violation on client_request_id means a retry already succeeded.
  if (error && error.code !== '23505') throw error;
}

export async function deleteMessage(messageId: string) {
  unwrap(await supabase.rpc('delete_message', { p_message: messageId }));
}

export async function markConversationRead(conversationId: string) {
  unwrap(await supabase.rpc('mark_conversation_read', { p_conversation: conversationId }));
}

// ---------------------------------------------------------------- notifications

export async function listNotifications(): Promise<NotificationRow[]> {
  const rows = unwrap(
    await supabase
      .from('notifications')
      .select(
        `id, type, actor_id, post_id, comment_id, meetup_id, conversation_id, data, read_at, created_at,
         actor:profiles!notifications_actor_id_fkey(${CARD})`,
      )
      .order('created_at', { ascending: false })
      .limit(60),
  );
  return rows as unknown as NotificationRow[];
}

export async function unreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
    .neq('type', 'message');
  if (error) throw error;
  return count ?? 0;
}

export async function markAllNotificationsRead() {
  const me = await currentUserId();
  unwrap(
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', me).is('read_at', null),
  );
}

export async function markNotificationRead(id: string) {
  unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id));
}

// ---------------------------------------------------------------- meetups

export async function listMeetups(filters: {
  meetupId?: string;
  country?: string | null;
  city?: string | null;
  category?: MeetupCategory | null;
  hostId?: string;
  query?: string | null;
  includePast?: boolean;
  offset?: number;
}): Promise<Meetup[]> {
  return unwrap(
    await supabase.rpc('list_meetups', {
      p_meetup: filters.meetupId,
      p_country: filters.country ?? undefined,
      p_city: filters.city || undefined,
      p_category: filters.category ?? undefined,
      p_host: filters.hostId,
      p_query: filters.query || undefined,
      p_include_past: filters.includePast ?? false,
      p_limit: 20,
      p_offset: filters.offset ?? 0,
    }),
  );
}

export async function getMeetup(meetupId: string): Promise<Meetup | null> {
  const rows = await listMeetups({ meetupId });
  return rows[0] ?? null;
}

export type MeetupInput = {
  kind: 'chill' | 'event';
  title: string;
  description: string;
  category: MeetupCategory;
  country_code: string;
  city: string;
  venue_name: string | null;
  venue_address: string | null;
  venue_visibility: 'everyone' | 'attendees';
  starts_at: string | null;
  ends_at: string | null;
  capacity: number | null;
  audience: 'public' | 'friends';
};

export async function createMeetup(input: MeetupInput): Promise<string> {
  const me = await currentUserId();
  const row = unwrap(await supabase.from('meetups').insert({ ...input, host_id: me }).select('id').single());
  return (row as unknown as { id: string }).id;
}

export async function updateMeetup(meetupId: string, update: Partial<Omit<MeetupInput, 'country_code'>> & { status?: 'scheduled' | 'cancelled' }) {
  unwrap(await supabase.from('meetups').update(update).eq('id', meetupId));
}

export async function respondToMeetup(meetupId: string, status: MeetupResponse) {
  unwrap(await supabase.rpc('respond_to_meetup', { p_meetup: meetupId, p_status: status }));
}

export async function leaveMeetup(meetupId: string) {
  unwrap(await supabase.rpc('leave_meetup', { p_meetup: meetupId }));
}

export async function listMeetupAttendees(meetupId: string) {
  const rows = unwrap(
    await supabase
      .from('meetup_responses')
      .select(`user_id, status, profile:profiles!meetup_responses_user_id_fkey(${CARD})`)
      .eq('meetup_id', meetupId)
      .in('status', ['going', 'interested'])
      .limit(200),
  );
  return rows as unknown as { user_id: string; status: MeetupResponse; profile: PersonCard | null }[];
}

// ---------------------------------------------------------------- dating

export async function getMyDatingPreferences(): Promise<DatingPreferences | null> {
  return unwrap(await supabase.from('dating_preferences').select('*').maybeSingle());
}

export type DatingInput = {
  enabled: boolean;
  paused: boolean;
  gender: DatingGender;
  interested_in: DatingGender[];
  min_age: number;
  max_age: number;
  countries: string[];
  max_distance_km: number | null;
  goals: DatingGoal[];
  headline: string;
  about: string;
  show_on_profile: boolean;
};

export async function saveDatingPreferences(input: DatingInput) {
  const me = await currentUserId();
  unwrap(await supabase.from('dating_preferences').upsert({ ...input, user_id: me }, { onConflict: 'user_id' }));
}

export async function leaveDating() {
  const me = await currentUserId();
  unwrap(await supabase.from('dating_preferences').delete().eq('user_id', me));
}

export async function getDatingCandidates(): Promise<DatingCandidate[]> {
  return unwrap(await supabase.rpc('get_dating_candidates', { p_limit: 20 }));
}

export async function datingRespond(userId: string, decision: 'like' | 'pass'): Promise<boolean> {
  return unwrap(await supabase.rpc('dating_respond', { p_target: userId, p_decision: decision }));
}

export async function listDatingMatches() {
  return unwrap(await supabase.rpc('list_dating_matches'));
}

export async function unmatch(userId: string) {
  unwrap(await supabase.rpc('dating_unmatch', { p_other: userId }));
}

// ---------------------------------------------------------------- safety

export async function createReport(target: ReportTarget, targetId: string, reason: ReportReason, details: string) {
  return unwrap(
    await supabase.rpc('create_report', {
      p_target_type: target,
      p_target_id: targetId,
      p_reason: reason,
      p_details: details,
    }),
  );
}

export async function listMyModerationActions() {
  const me = await currentUserId();
  return unwrap(
    await supabase
      .from('moderation_actions')
      .select('id, action, reason, content_type, expires_at, created_at')
      .eq('target_user_id', me)
      .order('created_at', { ascending: false }),
  );
}

export async function listMyAppeals() {
  const me = await currentUserId();
  return unwrap(
    await supabase
      .from('appeals')
      .select('id, moderation_action_id, status, decision_note, created_at, decided_at')
      .eq('user_id', me),
  );
}

export async function submitAppeal(actionId: string, message: string) {
  return unwrap(await supabase.rpc('submit_appeal', { p_action: actionId, p_message: message }));
}

// ---------------------------------------------------------------- admin

export const admin = {
  metrics: async () => unwrap(await supabase.rpc('admin_metrics')) as Record<string, unknown>,
  listReports: async (status?: 'open' | 'in_review' | 'actioned' | 'dismissed') =>
    unwrap(await supabase.rpc('admin_list_reports', { p_status: status, p_limit: 100 })),
  getReport: async (reportId: string) =>
    unwrap(await supabase.rpc('admin_get_report', { p_report: reportId })) as Record<string, any>,
  updateReport: async (reportId: string, status: 'open' | 'in_review' | 'actioned' | 'dismissed', note?: string) =>
    unwrap(await supabase.rpc('admin_update_report', { p_report: reportId, p_status: status, p_note: note })),
  moderateContent: async (type: ReportTarget, contentId: string, remove: boolean, reason: string, reportId?: string) =>
    unwrap(
      await supabase.rpc('admin_moderate_content', {
        p_content_type: type,
        p_content_id: contentId,
        p_remove: remove,
        p_reason: reason,
        p_report: reportId,
      }),
    ),
  setAccountStatus: async (
    userId: string,
    status: 'active' | 'suspended' | 'banned',
    reason: string,
    until?: string,
    reportId?: string,
  ) =>
    unwrap(
      await supabase.rpc('admin_set_account_status', {
        p_user: userId,
        p_status: status,
        p_reason: reason,
        p_until: until,
        p_report: reportId,
      }),
    ),
  warnUser: async (userId: string, reason: string, reportId?: string) =>
    unwrap(await supabase.rpc('admin_warn_user', { p_user: userId, p_reason: reason, p_report: reportId })),
  listAppeals: async () => unwrap(await supabase.rpc('admin_list_appeals', { p_status: 'open' })),
  decideAppeal: async (appealId: string, overturn: boolean, note: string) =>
    unwrap(await supabase.rpc('admin_decide_appeal', { p_appeal: appealId, p_overturn: overturn, p_note: note })),
  searchUsers: async (query: string) => unwrap(await supabase.rpc('admin_search_users', { p_query: query })),
  setStaffRole: async (userId: string, role: 'moderator' | 'admin' | null) =>
    unwrap(await supabase.rpc('admin_set_staff_role', { p_user: userId, p_role: role ?? undefined })),
};
