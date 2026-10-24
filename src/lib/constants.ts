import type {
  DatingGender,
  DatingGoal,
  MeetupCategory,
  PostAudience,
  ReportReason,
  SocialIntent,
} from './types';

/** ISO 639 codes for languages widely spoken across Africa (extendable). */
export const LANGUAGES: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'sw', label: 'Swahili' },
  { value: 'zu', label: 'isiZulu' },
  { value: 'xh', label: 'isiXhosa' },
  { value: 'af', label: 'Afrikaans' },
  { value: 'st', label: 'Sesotho' },
  { value: 'tn', label: 'Setswana' },
  { value: 'nso', label: 'Sepedi' },
  { value: 'ts', label: 'Xitsonga' },
  { value: 'ss', label: 'siSwati' },
  { value: 've', label: 'Tshivenda' },
  { value: 'nr', label: 'isiNdebele (South)' },
  { value: 'nd', label: 'isiNdebele (North)' },
  { value: 'sn', label: 'Shona' },
  { value: 'ny', label: 'Chichewa' },
  { value: 'bem', label: 'Bemba' },
  { value: 'yo', label: 'Yoruba' },
  { value: 'ig', label: 'Igbo' },
  { value: 'ha', label: 'Hausa' },
  { value: 'ak', label: 'Akan / Twi' },
  { value: 'ee', label: 'Ewe' },
  { value: 'wo', label: 'Wolof' },
  { value: 'ff', label: 'Fula' },
  { value: 'bm', label: 'Bambara' },
  { value: 'am', label: 'Amharic' },
  { value: 'om', label: 'Oromo' },
  { value: 'ti', label: 'Tigrinya' },
  { value: 'so', label: 'Somali' },
  { value: 'rw', label: 'Kinyarwanda' },
  { value: 'rn', label: 'Kirundi' },
  { value: 'lg', label: 'Luganda' },
  { value: 'ln', label: 'Lingala' },
  { value: 'kg', label: 'Kikongo' },
  { value: 'mg', label: 'Malagasy' },
  { value: 'kab', label: 'Kabyle' },
  { value: 'ber', label: 'Amazigh (Berber)' },
  { value: 'es', label: 'Spanish' },
];

export const languageLabel = (code: string) => LANGUAGES.find((l) => l.value === code)?.label ?? code;

export const INTEREST_SUGGESTIONS = [
  'football', 'music', 'amapiano', 'afrobeats', 'church', 'fashion', 'food', 'cooking', 'travel',
  'tech', 'startups', 'books', 'photography', 'art', 'dance', 'fitness', 'running', 'hiking',
  'gaming', 'movies', 'nollywood', 'comedy', 'basketball', 'rugby', 'cricket', 'athletics',
  'business', 'volunteering', 'languages', 'nature',
];

export const INTENTS: { value: SocialIntent; label: string }[] = [
  { value: 'friendship', label: 'New friends' },
  { value: 'socialising', label: 'Hanging out' },
  { value: 'networking', label: 'Networking' },
  { value: 'travel_buddies', label: 'Travel buddies' },
  { value: 'meetups', label: 'Meetups' },
];

export const AUDIENCES: { value: PostAudience; label: string; description: string; icon: 'earth' | 'people' | 'lock-closed' }[] = [
  { value: 'public', label: 'Everyone', description: 'All Patapata members', icon: 'earth' },
  { value: 'friends', label: 'Friends', description: 'Only your friends', icon: 'people' },
  { value: 'only_me', label: 'Only me', description: 'Private to you', icon: 'lock-closed' },
];

export const MEETUP_CATEGORIES: { value: MeetupCategory; label: string; emoji: string }[] = [
  { value: 'coffee', label: 'Coffee', emoji: '☕' },
  { value: 'food', label: 'Food', emoji: '🍲' },
  { value: 'football', label: 'Football', emoji: '⚽' },
  { value: 'sport', label: 'Sport', emoji: '🏃' },
  { value: 'music', label: 'Music', emoji: '🎶' },
  { value: 'culture', label: 'Culture', emoji: '🎨' },
  { value: 'outdoors', label: 'Outdoors', emoji: '🌄' },
  { value: 'study', label: 'Study', emoji: '📚' },
  { value: 'networking', label: 'Networking', emoji: '🤝' },
  { value: 'travel', label: 'Travel', emoji: '✈️' },
  { value: 'faith', label: 'Faith', emoji: '🕊️' },
  { value: 'other', label: 'Other', emoji: '✨' },
];

export const categoryLabel = (c: MeetupCategory) => MEETUP_CATEGORIES.find((x) => x.value === c);

export const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying', description: 'Insults, threats or repeated unwanted contact' },
  { value: 'violence_threat', label: 'Threat of violence', description: 'Someone may be in danger' },
  { value: 'child_safety', label: 'Child safety', description: 'Anything that could harm or exploit a child' },
  { value: 'underage', label: 'Under 18', description: 'This person seems to be under 18' },
  { value: 'self_harm', label: 'Self-harm or suicide', description: 'Someone may be at risk' },
  { value: 'hate', label: 'Hate speech', description: 'Attacks on people for who they are' },
  { value: 'sexual_content', label: 'Sexual content', description: 'Nudity or unwanted sexual messages' },
  { value: 'scam', label: 'Scam or fraud', description: 'Requests for money, fake offers, phishing' },
  { value: 'impersonation', label: 'Impersonation', description: 'Pretending to be someone else' },
  { value: 'privacy_violation', label: 'Private information', description: 'Sharing someone’s address, ID or photos without consent' },
  { value: 'spam', label: 'Spam', description: 'Repetitive or misleading content' },
  { value: 'other', label: 'Something else', description: 'Tell us more below' },
];

export const DATING_GENDERS: { value: DatingGender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
];

export const DATING_GOALS: { value: DatingGoal; label: string }[] = [
  { value: 'long_term', label: 'Long-term relationship' },
  { value: 'dating', label: 'Dating' },
  { value: 'friendship_first', label: 'Friendship first' },
  { value: 'not_sure', label: 'Not sure yet' },
];

export const TAGLINE = 'Africa Connects Here.';
export const SECONDARY_MESSAGE = 'Your People. Your Stories. Your Africa.';
