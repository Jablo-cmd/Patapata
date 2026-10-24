/**
 * Maps database/auth error codes to friendly, actionable messages. The
 * database raises short machine-readable codes (e.g. "rate_limited: ...");
 * we match on the code prefix.
 */
const MESSAGES: Record<string, string> = {
  rate_limited: 'You are doing that a little too often. Please wait a moment and try again.',
  not_authenticated: 'Please sign in again.',
  account_not_active: 'Your account cannot do this right now.',
  email_not_verified: 'Please verify your email address first.',
  age_ineligible: 'Patapata is only for adults aged 18 and over.',
  invalid_birth_date: 'Please enter a valid date of birth.',
  terms_not_accepted: 'Please accept the community guidelines and terms to continue.',
  username_unavailable: 'That username is not available. Try another one.',
  invalid_country: 'Please choose your country.',
  display_name_required: 'Please enter your name.',
  already_onboarded: 'Your profile is already set up.',
  cannot_friend_self: 'You cannot send a friend request to yourself.',
  user_unavailable: 'This member is not available.',
  friend_requests_disabled: 'This member is not accepting friend requests.',
  request_not_found: 'This friend request no longer exists.',
  post_too_long: 'Posts can be up to 5,000 characters.',
  too_many_images: 'You can add up to 6 photos to a post.',
  empty_post: 'Write something or add a photo first.',
  duplicate_post: 'It looks like you just posted this.',
  post_not_found: 'This post is no longer available.',
  post_not_shareable: 'Only public posts can be shared.',
  invalid_media_path: 'One of the photos could not be attached. Please try again.',
  media_not_uploaded: 'A photo did not finish uploading. Please try again.',
  messaging_not_allowed: 'This member only accepts messages from friends or matches.',
  cannot_message_self: 'You cannot message yourself.',
  empty_message: 'Write a message first.',
  message_not_found: 'This message is no longer available.',
  attachment_not_uploaded: 'The photo did not finish uploading. Please try again.',
  dating_not_enabled: 'Turn on dating mode to see suggestions.',
  dating_adults_only: 'Dating is only available to adults aged 18 and over.',
  dating_candidate_unavailable: 'This person is no longer available.',
  meetup_not_found: 'This meetup is no longer available.',
  meetup_full: 'This meetup is full.',
  meetup_not_open: 'This meetup is not open for responses.',
  meetup_finished: 'This meetup has already happened.',
  meetup_in_past: 'Please choose a time in the future.',
  meetup_too_far_ahead: 'Meetups can be planned up to a year ahead.',
  host_cannot_respond: 'You are hosting this meetup.',
  target_not_found: 'This item is no longer available to report.',
  location_required: 'Turn on approximate location to filter by distance.',
  invalid_coordinates: 'We could not read your location.',
  staff_only: 'Only Patapata moderators can do this.',
  admin_only: 'Only administrators can do this.',
  needs_independent_reviewer: 'Another moderator must review this appeal.',
  suspension_needs_end_date: 'Choose when the suspension ends.',
  cannot_moderate_self: 'You cannot moderate your own account.',
  not_deactivated: 'Your account is already active.',
  action_not_found: 'This decision cannot be appealed.',
  not_allowed: 'You are not allowed to do this.',
  avatar_not_uploaded: 'The photo did not finish uploading. Please try again.',
  cover_not_uploaded: 'The photo did not finish uploading. Please try again.',
  // Supabase Auth
  invalid_credentials: 'Email or password is incorrect.',
  email_not_confirmed: 'Please verify your email address first. Check your inbox for the code.',
  user_already_exists: 'An account with this email already exists. Try signing in.',
  weak_password: 'Please choose a stronger password (at least 10 characters with letters and numbers).',
  over_email_send_rate_limit: 'Too many emails sent. Please wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a few minutes and try again.',
  otp_expired: 'That code has expired or is incorrect. Request a new one.',
  same_password: 'Your new password must be different from the old one.',
};

type ErrorLike = { message?: string; code?: string; hint?: string; status?: number } | null | undefined;

export function errorCode(error: unknown): string | undefined {
  const e = error as ErrorLike;
  if (!e) return undefined;
  if (e.code && MESSAGES[e.code]) return e.code;
  const fromMessage = e.message?.split(':')[0]?.trim();
  if (fromMessage && MESSAGES[fromMessage]) return fromMessage;
  if (e.hint && MESSAGES[e.hint]) return e.hint;
  return e.code ?? fromMessage;
}

export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = error as ErrorLike;
  if (!e) return fallback;
  const code = errorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (e.message && /network|fetch|timeout/i.test(e.message)) {
    return 'You seem to be offline. Check your connection and try again.';
  }
  if (e.code === '42501') return MESSAGES.not_allowed;
  return fallback;
}

export function isNetworkError(error: unknown): boolean {
  const message = (error as ErrorLike)?.message ?? '';
  return /network request failed|failed to fetch|timeout/i.test(message);
}
