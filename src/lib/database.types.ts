
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "appeals": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decision_note": string | null,"id": string,"message": string,"moderation_action_id": string,"reviewer_id": string | null,"status": Database["public"]['Enums']["appeal_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decision_note"?: string | null,"id"?: string,"message": string,"moderation_action_id": string,"reviewer_id"?: string | null,"status"?: Database["public"]['Enums']["appeal_status"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decision_note"?: string | null,"id"?: string,"message"?: string,"moderation_action_id"?: string,"reviewer_id"?: string | null,"status"?: Database["public"]['Enums']["appeal_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appeals_moderation_action_id_fkey"
      columns: ["moderation_action_id"]
isOneToOne: false
      referencedRelation: "moderation_actions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appeals_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appeals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"edited_at": string | null,"id": string,"parent_id": string | null,"post_id": string,"reply_count": number,"status": Database["public"]['Enums']["content_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"parent_id"?: string | null,"post_id": string,"reply_count"?: number,"status"?: Database["public"]['Enums']["content_status"],"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"parent_id"?: string | null,"post_id"?: string,"reply_count"?: number,"status"?: Database["public"]['Enums']["content_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_members": {
                  Row: {
                    "conversation_id": string,"joined_at": string,"last_read_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"joined_at"?: string,"last_read_at"?: string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"joined_at"?: string,"last_read_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_members_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"direct_key": string | null,"id": string,"kind": Database["public"]['Enums']["conversation_kind"],"last_message_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"direct_key"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["conversation_kind"],"last_message_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"direct_key"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["conversation_kind"],"last_message_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"countries": {
                  Row: {
                    "calling_code": string,"code": string,"default_locale": string,"flag_emoji": string,"is_enabled": boolean,"is_launch_market": boolean,"name": string,"region": Database["public"]['Enums']["african_region"]
                  }
                  ComputedFields: never
                  Insert: {
                    "calling_code": string,"code": string,"default_locale"?: string,"flag_emoji": string,"is_enabled"?: boolean,"is_launch_market"?: boolean,"name": string,"region": Database["public"]['Enums']["african_region"]
                  }
                  Update: {
                    "calling_code"?: string,"code"?: string,"default_locale"?: string,"flag_emoji"?: string,"is_enabled"?: boolean,"is_launch_market"?: boolean,"name"?: string,"region"?: Database["public"]['Enums']["african_region"]
                  }
                  Relationships: [
                    
                  ]
                },"dating_matches": {
                  Row: {
                    "created_at": string,"id": string,"user_a": string,"user_b": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"user_a": string,"user_b": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"user_a"?: string,"user_b"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dating_matches_user_a_fkey"
      columns: ["user_a"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dating_matches_user_b_fkey"
      columns: ["user_b"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dating_preferences": {
                  Row: {
                    "about": string,"countries": (string)[],"created_at": string,"enabled": boolean,"gender": Database["public"]['Enums']["dating_gender"],"goals": (Database["public"]['Enums']["dating_goal"])[],"headline": string,"interested_in": (Database["public"]['Enums']["dating_gender"])[],"max_age": number,"max_distance_km": number | null,"min_age": number,"opted_in_at": string | null,"paused": boolean,"show_on_profile": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "about"?: string,"countries"?: (string)[],"created_at"?: string,"enabled"?: boolean,"gender": Database["public"]['Enums']["dating_gender"],"goals"?: (Database["public"]['Enums']["dating_goal"])[],"headline"?: string,"interested_in": (Database["public"]['Enums']["dating_gender"])[],"max_age"?: number,"max_distance_km"?: number | null,"min_age"?: number,"opted_in_at"?: string | null,"paused"?: boolean,"show_on_profile"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "about"?: string,"countries"?: (string)[],"created_at"?: string,"enabled"?: boolean,"gender"?: Database["public"]['Enums']["dating_gender"],"goals"?: (Database["public"]['Enums']["dating_goal"])[],"headline"?: string,"interested_in"?: (Database["public"]['Enums']["dating_gender"])[],"max_age"?: number,"max_distance_km"?: number | null,"min_age"?: number,"opted_in_at"?: string | null,"paused"?: boolean,"show_on_profile"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dating_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dating_swipes": {
                  Row: {
                    "actor_id": string,"created_at": string,"decision": Database["public"]['Enums']["dating_decision"],"target_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"created_at"?: string,"decision": Database["public"]['Enums']["dating_decision"],"target_id": string
                  }
                  Update: {
                    "actor_id"?: string,"created_at"?: string,"decision"?: Database["public"]['Enums']["dating_decision"],"target_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dating_swipes_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dating_swipes_target_id_fkey"
      columns: ["target_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"friendships": {
                  Row: {
                    "addressee_id": string,"created_at": string,"id": string,"requester_id": string,"responded_at": string | null,"status": Database["public"]['Enums']["friendship_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "addressee_id": string,"created_at"?: string,"id"?: string,"requester_id": string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["friendship_status"]
                  }
                  Update: {
                    "addressee_id"?: string,"created_at"?: string,"id"?: string,"requester_id"?: string,"responded_at"?: string | null,"status"?: Database["public"]['Enums']["friendship_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "friendships_addressee_id_fkey"
      columns: ["addressee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "friendships_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"meetup_responses": {
                  Row: {
                    "created_at": string,"meetup_id": string,"status": Database["public"]['Enums']["meetup_response_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"meetup_id": string,"status": Database["public"]['Enums']["meetup_response_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"meetup_id"?: string,"status"?: Database["public"]['Enums']["meetup_response_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetup_responses_meetup_id_fkey"
      columns: ["meetup_id"]
isOneToOne: false
      referencedRelation: "meetups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_responses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"meetups": {
                  Row: {
                    "audience": Database["public"]['Enums']["meetup_audience"],"capacity": number | null,"category": Database["public"]['Enums']["meetup_category"],"city": string,"country_code": string,"created_at": string,"description": string,"ends_at": string | null,"going_count": number,"host_id": string,"id": string,"interested_count": number,"kind": Database["public"]['Enums']["meetup_kind"],"search": unknown,"starts_at": string | null,"status": Database["public"]['Enums']["meetup_status"],"title": string,"updated_at": string,"venue_address": string | null,"venue_name": string | null,"venue_visibility": Database["public"]['Enums']["venue_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: Database["public"]['Enums']["meetup_audience"],"capacity"?: number | null,"category"?: Database["public"]['Enums']["meetup_category"],"city": string,"country_code": string,"created_at"?: string,"description"?: string,"ends_at"?: string | null,"going_count"?: number,"host_id": string,"id"?: string,"interested_count"?: number,"kind"?: Database["public"]['Enums']["meetup_kind"],"search"?: never,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["meetup_status"],"title": string,"updated_at"?: string,"venue_address"?: string | null,"venue_name"?: string | null,"venue_visibility"?: Database["public"]['Enums']["venue_visibility"]
                  }
                  Update: {
                    "audience"?: Database["public"]['Enums']["meetup_audience"],"capacity"?: number | null,"category"?: Database["public"]['Enums']["meetup_category"],"city"?: string,"country_code"?: string,"created_at"?: string,"description"?: string,"ends_at"?: string | null,"going_count"?: number,"host_id"?: string,"id"?: string,"interested_count"?: number,"kind"?: Database["public"]['Enums']["meetup_kind"],"search"?: never,"starts_at"?: string | null,"status"?: Database["public"]['Enums']["meetup_status"],"title"?: string,"updated_at"?: string,"venue_address"?: string | null,"venue_name"?: string | null,"venue_visibility"?: Database["public"]['Enums']["venue_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetups_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "meetups_host_id_fkey"
      columns: ["host_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "attachment_path": string | null,"body": string,"client_request_id": string | null,"conversation_id": string,"created_at": string,"deleted_at": string | null,"id": string,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_path"?: string | null,"body"?: string,"client_request_id"?: string | null,"conversation_id": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"sender_id": string
                  }
                  Update: {
                    "attachment_path"?: string | null,"body"?: string,"client_request_id"?: string | null,"conversation_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_actions": {
                  Row: {
                    "action": Database["public"]['Enums']["moderation_action_type"],"content_id": string | null,"content_type": Database["public"]['Enums']["report_target"] | null,"created_at": string,"expires_at": string | null,"id": string,"moderator_id": string | null,"reason": string,"report_id": string | null,"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": Database["public"]['Enums']["moderation_action_type"],"content_id"?: string | null,"content_type"?: Database["public"]['Enums']["report_target"] | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"moderator_id"?: string | null,"reason": string,"report_id"?: string | null,"target_user_id"?: string | null
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["moderation_action_type"],"content_id"?: string | null,"content_type"?: Database["public"]['Enums']["report_target"] | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"moderator_id"?: string | null,"reason"?: string,"report_id"?: string | null,"target_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_actions_moderator_id_fkey"
      columns: ["moderator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_actions_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_actions_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "comments": boolean,"dating": boolean,"friend_requests": boolean,"likes": boolean,"meetups": boolean,"mentions": boolean,"messages": boolean,"push_enabled": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comments"?: boolean,"dating"?: boolean,"friend_requests"?: boolean,"likes"?: boolean,"meetups"?: boolean,"mentions"?: boolean,"messages"?: boolean,"push_enabled"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "comments"?: boolean,"dating"?: boolean,"friend_requests"?: boolean,"likes"?: boolean,"meetups"?: boolean,"mentions"?: boolean,"messages"?: boolean,"push_enabled"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"comment_id": string | null,"conversation_id": string | null,"created_at": string,"data": NonNullable<Json>,"friendship_id": string | null,"id": string,"meetup_id": string | null,"post_id": string | null,"read_at": string | null,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"comment_id"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"friendship_id"?: string | null,"id"?: string,"meetup_id"?: string | null,"post_id"?: string | null,"read_at"?: string | null,"type": Database["public"]['Enums']["notification_type"],"user_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"comment_id"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"friendship_id"?: string | null,"id"?: string,"meetup_id"?: string | null,"post_id"?: string | null,"read_at"?: string | null,"type"?: Database["public"]['Enums']["notification_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_comment_fk"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_conversation_fk"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_friendship_id_fkey"
      columns: ["friendship_id"]
isOneToOne: false
      referencedRelation: "friendships"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_meetup_fk"
      columns: ["meetup_id"]
isOneToOne: false
      referencedRelation: "meetups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_post_fk"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"post_media": {
                  Row: {
                    "created_at": string,"height": number | null,"id": string,"owner_id": string,"position": number,"post_id": string,"storage_path": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"height"?: number | null,"id"?: string,"owner_id": string,"position"?: number,"post_id": string,"storage_path": string,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"height"?: number | null,"id"?: string,"owner_id"?: string,"position"?: number,"post_id"?: string,"storage_path"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_media_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_media_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"post_reactions": {
                  Row: {
                    "created_at": string,"kind": Database["public"]['Enums']["reaction_kind"],"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"kind"?: Database["public"]['Enums']["reaction_kind"],"post_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"kind"?: Database["public"]['Enums']["reaction_kind"],"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_reactions_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "audience": Database["public"]['Enums']["post_audience"],"author_id": string,"body": string,"client_request_id": string | null,"comment_count": number,"created_at": string,"edited_at": string | null,"id": string,"like_count": number,"media_count": number,"removed_reason": string | null,"share_count": number,"shared_post_id": string | null,"status": Database["public"]['Enums']["content_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: Database["public"]['Enums']["post_audience"],"author_id": string,"body"?: string,"client_request_id"?: string | null,"comment_count"?: number,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"like_count"?: number,"media_count"?: number,"removed_reason"?: string | null,"share_count"?: number,"shared_post_id"?: string | null,"status"?: Database["public"]['Enums']["content_status"],"updated_at"?: string
                  }
                  Update: {
                    "audience"?: Database["public"]['Enums']["post_audience"],"author_id"?: string,"body"?: string,"client_request_id"?: string | null,"comment_count"?: number,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"like_count"?: number,"media_count"?: number,"removed_reason"?: string | null,"share_count"?: number,"shared_post_id"?: string | null,"status"?: Database["public"]['Enums']["content_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_shared_post_id_fkey"
      columns: ["shared_post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_private": {
                  Row: {
                    "accepted_terms_at": string,"birth_date": string,"created_at": string,"location": unknown,"location_updated_at": string | null,"terms_version": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_terms_at": string,"birth_date": string,"created_at"?: string,"location"?: unknown,"location_updated_at"?: string | null,"terms_version": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "accepted_terms_at"?: string,"birth_date"?: string,"created_at"?: string,"location"?: unknown,"location_updated_at"?: string | null,"terms_version"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_private_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"bio": string,"city": string | null,"country_code": string | null,"cover_path": string | null,"created_at": string,"deletion_requested_at": string | null,"display_name": string,"hobbies": (string)[],"id": string,"intents": (Database["public"]['Enums']["social_intent"])[],"interests": (string)[],"languages": (string)[],"last_active_at": string | null,"onboarded_at": string | null,"region": string | null,"status": Database["public"]['Enums']["account_status"],"status_before_deactivation": Database["public"]['Enums']["account_status"] | null,"suspended_until": string | null,"updated_at": string,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"bio"?: string,"city"?: string | null,"country_code"?: string | null,"cover_path"?: string | null,"created_at"?: string,"deletion_requested_at"?: string | null,"display_name"?: string,"hobbies"?: (string)[],"id": string,"intents"?: (Database["public"]['Enums']["social_intent"])[],"interests"?: (string)[],"languages"?: (string)[],"last_active_at"?: string | null,"onboarded_at"?: string | null,"region"?: string | null,"status"?: Database["public"]['Enums']["account_status"],"status_before_deactivation"?: Database["public"]['Enums']["account_status"] | null,"suspended_until"?: string | null,"updated_at"?: string,"username"?: string | null
                  }
                  Update: {
                    "avatar_path"?: string | null,"bio"?: string,"city"?: string | null,"country_code"?: string | null,"cover_path"?: string | null,"created_at"?: string,"deletion_requested_at"?: string | null,"display_name"?: string,"hobbies"?: (string)[],"id"?: string,"intents"?: (Database["public"]['Enums']["social_intent"])[],"interests"?: (string)[],"languages"?: (string)[],"last_active_at"?: string | null,"onboarded_at"?: string | null,"region"?: string | null,"status"?: Database["public"]['Enums']["account_status"],"status_before_deactivation"?: Database["public"]['Enums']["account_status"] | null,"suspended_until"?: string | null,"updated_at"?: string,"username"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    }
                  ]
                },"regions": {
                  Row: {
                    "country_code": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country_code": string,"id"?: never,"name": string
                  }
                  Update: {
                    "country_code"?: string,"id"?: never,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "regions_country_code_fkey"
      columns: ["country_code"]
isOneToOne: false
      referencedRelation: "countries"
      referencedColumns: ["code"]
    }
                  ]
                },"reports": {
                  Row: {
                    "assigned_to": string | null,"comment_id": string | null,"created_at": string,"details": string,"evidence": NonNullable<Json>,"id": string,"meetup_id": string | null,"message_id": string | null,"post_id": string | null,"priority": Database["public"]['Enums']["report_priority"],"reason": Database["public"]['Enums']["report_reason"],"reporter_id": string | null,"resolution_note": string | null,"resolved_at": string | null,"status": Database["public"]['Enums']["report_status"],"target_type": Database["public"]['Enums']["report_target"],"target_user_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"comment_id"?: string | null,"created_at"?: string,"details"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"meetup_id"?: string | null,"message_id"?: string | null,"post_id"?: string | null,"priority": Database["public"]['Enums']["report_priority"],"reason": Database["public"]['Enums']["report_reason"],"reporter_id"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_type": Database["public"]['Enums']["report_target"],"target_user_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"comment_id"?: string | null,"created_at"?: string,"details"?: string,"evidence"?: NonNullable<Json>,"id"?: string,"meetup_id"?: string | null,"message_id"?: string | null,"post_id"?: string | null,"priority"?: Database["public"]['Enums']["report_priority"],"reason"?: Database["public"]['Enums']["report_reason"],"reporter_id"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"target_type"?: Database["public"]['Enums']["report_target"],"target_user_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_meetup_id_fkey"
      columns: ["meetup_id"]
isOneToOne: false
      referencedRelation: "meetups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_roles": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"role": Database["public"]['Enums']["staff_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"role": Database["public"]['Enums']["staff_role"],"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"role"?: Database["public"]['Enums']["staff_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_roles_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_privacy_settings": {
                  Row: {
                    "discoverable": boolean,"friend_requests_from": Database["public"]['Enums']["friend_request_policy"],"friends_list_visibility": Database["public"]['Enums']["list_visibility"],"location_enabled": boolean,"messages_from": Database["public"]['Enums']["message_policy"],"profile_visibility": Database["public"]['Enums']["profile_visibility"],"show_age": boolean,"show_city": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "discoverable"?: boolean,"friend_requests_from"?: Database["public"]['Enums']["friend_request_policy"],"friends_list_visibility"?: Database["public"]['Enums']["list_visibility"],"location_enabled"?: boolean,"messages_from"?: Database["public"]['Enums']["message_policy"],"profile_visibility"?: Database["public"]['Enums']["profile_visibility"],"show_age"?: boolean,"show_city"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "discoverable"?: boolean,"friend_requests_from"?: Database["public"]['Enums']["friend_request_policy"],"friends_list_visibility"?: Database["public"]['Enums']["list_visibility"],"location_enabled"?: boolean,"messages_from"?: Database["public"]['Enums']["message_policy"],"profile_visibility"?: Database["public"]['Enums']["profile_visibility"],"show_age"?: boolean,"show_city"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_privacy_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_decide_appeal":
{ Args: { "p_appeal": string,"p_note": string,"p_overturn": boolean }; Returns: undefined
                           },
"admin_get_report":
{ Args: { "p_report": string }; Returns: Json
                           },
"admin_list_appeals":
{ Args: { "p_status"?: Database["public"]['Enums']["appeal_status"] }; Returns: {
              "action": Database["public"]['Enums']["moderation_action_type"],"action_created_at": string,"action_id": string,"action_reason": string,"content_id": string,"content_type": Database["public"]['Enums']["report_target"],"created_at": string,"id": string,"message": string,"status": Database["public"]['Enums']["appeal_status"],"user_id": string,"username": string
            }[]
                           },
"admin_list_reports":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_priority"?: Database["public"]['Enums']["report_priority"],"p_status"?: Database["public"]['Enums']["report_status"] }; Returns: {
              "assigned_to": string,"created_at": string,"details": string,"id": string,"priority": Database["public"]['Enums']["report_priority"],"reason": Database["public"]['Enums']["report_reason"],"reporter_id": string,"reporter_username": string,"reports_against_target": number,"status": Database["public"]['Enums']["report_status"],"target_status": Database["public"]['Enums']["account_status"],"target_type": Database["public"]['Enums']["report_target"],"target_user_id": string,"target_username": string
            }[]
                           },
"admin_metrics":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_moderate_content":
{ Args: { "p_content_id": string,"p_content_type": Database["public"]['Enums']["report_target"],"p_reason": string,"p_remove": boolean,"p_report"?: string }; Returns: string
                           },
"admin_search_users":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: {
              "country_code": string,"created_at": string,"display_name": string,"email": string,"id": string,"reports_against": number,"staff_role": Database["public"]['Enums']["staff_role"],"status": Database["public"]['Enums']["account_status"],"suspended_until": string,"username": string
            }[]
                           },
"admin_set_account_status":
{ Args: { "p_reason": string,"p_report"?: string,"p_status": Database["public"]['Enums']["account_status"],"p_until"?: string,"p_user": string }; Returns: string
                           },
"admin_set_staff_role":
{ Args: { "p_role"?: Database["public"]['Enums']["staff_role"],"p_user": string }; Returns: undefined
                           },
"admin_update_report":
{ Args: { "p_note"?: string,"p_report": string,"p_status": Database["public"]['Enums']["report_status"] }; Returns: undefined
                           },
"admin_warn_user":
{ Args: { "p_reason": string,"p_report"?: string,"p_user": string }; Returns: string
                           },
"cancel_friend_request":
{ Args: { "p_target": string }; Returns: undefined
                           },
"change_username":
{ Args: { "p_username": string }; Returns: undefined
                           },
"clear_location":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"complete_onboarding":
{ Args: { "p_accept_terms"?: boolean,"p_birth_date": string,"p_city"?: string,"p_country_code": string,"p_display_name": string,"p_intents"?: (Database["public"]['Enums']["social_intent"])[],"p_interests"?: (string)[],"p_languages"?: (string)[],"p_region"?: string,"p_terms_version"?: string,"p_username": string }; Returns: string
                           },
"create_post":
{ Args: { "p_audience"?: Database["public"]['Enums']["post_audience"],"p_body": string,"p_client_request_id"?: string,"p_media"?: Json,"p_shared_post_id"?: string }; Returns: string
                           },
"create_report":
{ Args: { "p_details"?: string,"p_reason": Database["public"]['Enums']["report_reason"],"p_target_id": string,"p_target_type": Database["public"]['Enums']["report_target"] }; Returns: string
                           },
"dating_respond":
{ Args: { "p_decision": Database["public"]['Enums']["dating_decision"],"p_target": string }; Returns: boolean
                           },
"dating_unmatch":
{ Args: { "p_other": string }; Returns: undefined
                           },
"deactivate_account":
{ Args: { "p_delete"?: boolean }; Returns: undefined
                           },
"delete_message":
{ Args: { "p_message": string }; Returns: undefined
                           },
"discover_people":
{ Args: { "p_city"?: string,"p_country"?: string,"p_intent"?: Database["public"]['Enums']["social_intent"],"p_interests"?: (string)[],"p_languages"?: (string)[],"p_limit"?: number,"p_max_age"?: number,"p_max_distance_km"?: number,"p_min_age"?: number,"p_offset"?: number,"p_query"?: string,"p_region"?: string }; Returns: {
              "age": number,"avatar_path": string,"city": string,"country_code": string,"display_name": string,"distance_band": string,"friendship": string,"id": string,"intents": (Database["public"]['Enums']["social_intent"])[],"interests": (string)[],"languages": (string)[],"mutual_friends": number,"username": string
            }[]
                           },
"get_dating_candidates":
{ Args: { "p_limit"?: number }; Returns: {
              "about": string,"age": number,"avatar_path": string,"city": string,"country_code": string,"display_name": string,"distance_band": string,"goals": (Database["public"]['Enums']["dating_goal"])[],"headline": string,"interests": (string)[],"languages": (string)[],"user_id": string,"username": string
            }[]
                           },
"get_feed":
{ Args: { "p_before"?: string,"p_before_id"?: string,"p_country"?: string,"p_limit"?: number,"p_post"?: string,"p_query"?: string,"p_scope"?: string,"p_user"?: string }; Returns: {
              "audience": Database["public"]['Enums']["post_audience"],"author_avatar_path": string,"author_country_code": string,"author_display_name": string,"author_id": string,"author_username": string,"body": string,"comment_count": number,"created_at": string,"edited_at": string,"id": string,"like_count": number,"liked_by_me": boolean,"media": Json,"share_count": number,"shared_post": Json,"shared_post_id": string,"status": Database["public"]['Enums']["content_status"]
            }[]
                           },
"get_or_create_direct_conversation":
{ Args: { "p_other": string }; Returns: string
                           },
"get_profile":
{ Args: { "p_user_id"?: string,"p_username"?: string }; Returns: Json
                           },
"leave_meetup":
{ Args: { "p_meetup": string }; Returns: undefined
                           },
"list_blocked_users":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_path": string,"blocked_at": string,"display_name": string,"id": string,"username": string
            }[]
                           },
"list_conversations":
{ Args: { "p_before"?: string,"p_limit"?: number }; Returns: {
              "can_reply": boolean,"id": string,"last_message_at": string,"last_message_body": string,"last_message_has_attachment": boolean,"last_message_sender_id": string,"other_avatar_path": string,"other_display_name": string,"other_user_id": string,"other_username": string,"unread_count": number
            }[]
                           },
"list_dating_matches":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_path": string,"display_name": string,"match_id": string,"matched_at": string,"user_id": string,"username": string
            }[]
                           },
"list_friends":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_user": string }; Returns: {
              "avatar_path": string,"country_code": string,"display_name": string,"friends_since": string,"id": string,"username": string
            }[]
                           },
"list_meetups":
{ Args: { "p_category"?: Database["public"]['Enums']["meetup_category"],"p_city"?: string,"p_country"?: string,"p_host"?: string,"p_include_past"?: boolean,"p_limit"?: number,"p_meetup"?: string,"p_offset"?: number,"p_query"?: string }; Returns: {
              "audience": Database["public"]['Enums']["meetup_audience"],"capacity": number,"category": Database["public"]['Enums']["meetup_category"],"city": string,"country_code": string,"created_at": string,"description": string,"ends_at": string,"going_count": number,"host_avatar_path": string,"host_display_name": string,"host_id": string,"host_username": string,"id": string,"interested_count": number,"kind": Database["public"]['Enums']["meetup_kind"],"my_response": Database["public"]['Enums']["meetup_response_status"],"starts_at": string,"status": Database["public"]['Enums']["meetup_status"],"title": string,"venue_address": string,"venue_hidden": boolean,"venue_name": string,"venue_visibility": Database["public"]['Enums']["venue_visibility"]
            }[]
                           },
"mark_conversation_read":
{ Args: { "p_conversation": string }; Returns: undefined
                           },
"my_account_state":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"reactivate_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"remove_friend":
{ Args: { "p_target": string }; Returns: undefined
                           },
"respond_friend_request":
{ Args: { "p_accept": boolean,"p_requester": string }; Returns: undefined
                           },
"respond_to_meetup":
{ Args: { "p_meetup": string,"p_status": Database["public"]['Enums']["meetup_response_status"] }; Returns: undefined
                           },
"send_friend_request":
{ Args: { "p_target": string }; Returns: Database["public"]['Enums']["friendship_status"]
                           },
"service_accounts_due_for_purge":
{ Args: { "p_limit"?: number }; Returns: string[]
                           },
"service_claim_storage_deletions":
{ Args: { "p_limit"?: number }; Returns: {
              "bucket_id": string,"id": number,"object_path": string
            }[]
                           },
"service_release_storage_deletions":
{ Args: { "p_ids": (number)[] }; Returns: undefined
                           },
"set_approximate_location":
{ Args: { "p_lat": number,"p_lng": number }; Returns: undefined
                           },
"submit_appeal":
{ Args: { "p_action": string,"p_message": string }; Returns: string
                           },
"suggest_people":
{ Args: { "p_limit"?: number }; Returns: {
              "avatar_path": string,"country_code": string,"display_name": string,"id": string,"mutual_friends": number,"reason": string,"shared_interests": number,"username": string
            }[]
                           },
"touch_last_active":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"username_available":
{ Args: { "p_username": string }; Returns: boolean
                           }
          }
          Enums: {
            "account_status": "pending"|"active"|"suspended"|"banned"|"deactivated","african_region": "northern"|"western"|"central"|"eastern"|"southern","appeal_status": "open"|"upheld"|"overturned","content_status": "active"|"removed","conversation_kind": "direct","dating_decision": "like"|"pass","dating_gender": "woman"|"man"|"non_binary"|"other","dating_goal": "long_term"|"dating"|"friendship_first"|"not_sure","friend_request_policy": "everyone"|"nobody","friendship_status": "pending"|"accepted","list_visibility": "members"|"friends"|"only_me","meetup_audience": "public"|"friends","meetup_category": "coffee"|"food"|"sport"|"football"|"music"|"culture"|"outdoors"|"study"|"networking"|"travel"|"faith"|"other","meetup_kind": "chill"|"event","meetup_response_status": "going"|"interested"|"not_going","meetup_status": "scheduled"|"cancelled"|"removed","message_policy": "everyone"|"friends"|"nobody","moderation_action_type": "remove_content"|"restore_content"|"warn"|"suspend"|"ban"|"reinstate"|"dismiss_report"|"grant_role"|"revoke_role","notification_type": "friend_request"|"friend_accepted"|"post_like"|"post_comment"|"comment_reply"|"mention"|"post_share"|"message"|"meetup_response"|"meetup_update"|"dating_match"|"security"|"moderation","post_audience": "public"|"friends"|"only_me","profile_visibility": "members"|"friends","reaction_kind": "like","report_priority": "urgent"|"high"|"normal","report_reason": "spam"|"harassment"|"hate"|"violence_threat"|"sexual_content"|"child_safety"|"scam"|"impersonation"|"self_harm"|"underage"|"privacy_violation"|"other","report_status": "open"|"in_review"|"actioned"|"dismissed","report_target": "user"|"post"|"comment"|"message"|"meetup","social_intent": "friendship"|"socialising"|"networking"|"travel_buddies"|"meetups","staff_role": "moderator"|"admin","venue_visibility": "everyone"|"attendees"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "account_status": ["pending", "active", "suspended", "banned", "deactivated"],"african_region": ["northern", "western", "central", "eastern", "southern"],"appeal_status": ["open", "upheld", "overturned"],"content_status": ["active", "removed"],"conversation_kind": ["direct"],"dating_decision": ["like", "pass"],"dating_gender": ["woman", "man", "non_binary", "other"],"dating_goal": ["long_term", "dating", "friendship_first", "not_sure"],"friend_request_policy": ["everyone", "nobody"],"friendship_status": ["pending", "accepted"],"list_visibility": ["members", "friends", "only_me"],"meetup_audience": ["public", "friends"],"meetup_category": ["coffee", "food", "sport", "football", "music", "culture", "outdoors", "study", "networking", "travel", "faith", "other"],"meetup_kind": ["chill", "event"],"meetup_response_status": ["going", "interested", "not_going"],"meetup_status": ["scheduled", "cancelled", "removed"],"message_policy": ["everyone", "friends", "nobody"],"moderation_action_type": ["remove_content", "restore_content", "warn", "suspend", "ban", "reinstate", "dismiss_report", "grant_role", "revoke_role"],"notification_type": ["friend_request", "friend_accepted", "post_like", "post_comment", "comment_reply", "mention", "post_share", "message", "meetup_response", "meetup_update", "dating_match", "security", "moderation"],"post_audience": ["public", "friends", "only_me"],"profile_visibility": ["members", "friends"],"reaction_kind": ["like"],"report_priority": ["urgent", "high", "normal"],"report_reason": ["spam", "harassment", "hate", "violence_threat", "sexual_content", "child_safety", "scam", "impersonation", "self_harm", "underage", "privacy_violation", "other"],"report_status": ["open", "in_review", "actioned", "dismissed"],"report_target": ["user", "post", "comment", "message", "meetup"],"social_intent": ["friendship", "socialising", "networking", "travel_buddies", "meetups"],"staff_role": ["moderator", "admin"],"venue_visibility": ["everyone", "attendees"]
          }
        }
} as const
