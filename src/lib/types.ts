import type { Database } from './database.types';

type Public = Database['public'];
export type Enums = Public['Enums'];
export type Tables<T extends keyof Public['Tables']> = Public['Tables'][T]['Row'];
export type RpcReturn<T extends keyof Public['Functions']> = Public['Functions'][T]['Returns'];

export type AccountStatus = Enums['account_status'];
export type PostAudience = Enums['post_audience'];
export type SocialIntent = Enums['social_intent'];
export type ReportTarget = Enums['report_target'];
export type ReportReason = Enums['report_reason'];
export type MeetupCategory = Enums['meetup_category'];
export type MeetupResponse = Enums['meetup_response_status'];
export type DatingGender = Enums['dating_gender'];
export type DatingGoal = Enums['dating_goal'];
export type NotificationType = Enums['notification_type'];
export type StaffRole = Enums['staff_role'];

export type FriendshipState = 'self' | 'friends' | 'request_sent' | 'request_received' | 'none';

export type AccountState = {
  status: AccountStatus;
  suspended_until: string | null;
  deletion_requested_at: string | null;
  deletion_scheduled_for: string | null;
  onboarded: boolean;
  age_gate_failed: boolean;
  staff_role: StaffRole | null;
  email_verified: boolean;
};

/** Shape returned by the get_profile RPC (fields hidden by privacy are null). */
export type ProfileView = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  cover_path: string | null;
  country_code: string | null;
  joined_at: string;
  is_self: boolean;
  details_visible: boolean;
  bio: string | null;
  region: string | null;
  city: string | null;
  age: number | null;
  languages: string[];
  interests: string[];
  hobbies: string[];
  intents: SocialIntent[];
  open_to_dating: boolean;
  friendship: FriendshipState;
  friends_count: number | null;
  friends_list_visible: boolean;
  mutual_friends: number;
  can_message: boolean;
  can_send_friend_request: boolean;
  status: AccountStatus | null;
};

export type MediaItem = { path: string; width: number | null; height: number | null };

export type SharedPost = {
  id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_path: string | null;
  body: string;
  created_at: string;
  media: MediaItem[];
};

export type FeedPost = Omit<RpcReturn<'get_feed'>[number], 'media' | 'shared_post'> & {
  media: MediaItem[];
  shared_post: SharedPost | null;
};

export type PersonCard = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  country_code?: string | null;
};

export type Country = Tables<'countries'>;
export type Meetup = RpcReturn<'list_meetups'>[number];
export type Conversation = RpcReturn<'list_conversations'>[number];
export type DiscoverResult = RpcReturn<'discover_people'>[number];
export type DatingCandidate = RpcReturn<'get_dating_candidates'>[number];
export type DatingPreferences = Tables<'dating_preferences'>;
export type PrivacySettings = Tables<'user_privacy_settings'>;
export type NotificationPreferences = Tables<'notification_preferences'>;

export type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  status: Enums['content_status'];
  reply_count: number;
  edited_at: string | null;
  created_at: string;
  author: PersonCard | null;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  attachment_path: string | null;
  deleted_at: string | null;
  created_at: string;
  pending?: boolean;
};

export type NotificationRow = {
  id: string;
  type: NotificationType;
  actor_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  meetup_id: string | null;
  conversation_id: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  actor: PersonCard | null;
};

export type FriendRequestRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: Enums['friendship_status'];
  created_at: string;
  requester: PersonCard | null;
  addressee: PersonCard | null;
};
