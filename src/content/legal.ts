/**
 * In-app policy texts. These are DRAFTS written for product development and
 * must be reviewed by a qualified lawyer for each launch country (e.g. POPIA
 * in South Africa, NDPA in Nigeria, the Data Protection Act in Kenya) before
 * any public launch.
 */
export type LegalDoc = { title: string; updated: string; sections: { heading: string; body: string }[] };

const DRAFT = 'Draft for review — not yet approved for public launch.';

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  guidelines: {
    title: 'Community Guidelines',
    updated: DRAFT,
    sections: [
      {
        heading: 'Be respectful',
        body:
          'Patapata brings together people from many countries, cultures, languages and faiths. Treat everyone with respect. Disagree with ideas, not people.',
      },
      {
        heading: 'Adults only',
        body:
          'You must be 18 or older to use Patapata. Accounts that appear to belong to someone under 18 are removed. Any content that sexualises or endangers a child is removed and, where the law requires or allows, reported to the authorities.',
      },
      {
        heading: 'No harassment, threats or hate',
        body:
          'Do not threaten, bully, stalk or intimidate anyone. Do not attack people for their ethnicity, nationality, religion, gender, sexual orientation, disability or any other part of who they are.',
      },
      {
        heading: 'Consent comes first',
        body:
          'A profile, photo, like, match, message or meetup invitation is never consent to anything else. Do not send unwanted sexual messages or images. "No" — or no reply — means no.',
      },
      {
        heading: 'Be yourself',
        body:
          'Do not impersonate other people or organisations. Do not run fake accounts, scams or spam, and never ask members for money, bank details or identity documents.',
      },
      {
        heading: 'Respect privacy',
        body:
          'Do not share anyone’s home address, phone number, ID documents or private photos without their permission.',
      },
      {
        heading: 'What happens when rules are broken',
        body:
          'Moderators may remove content, give a warning, or temporarily or permanently restrict an account. You will be told what happened and why, and you can appeal. Appeals are reviewed by a different moderator.',
      },
    ],
  },
  safety: {
    title: 'Meeting People Safely',
    updated: DRAFT,
    sections: [
      {
        heading: 'Meet in public',
        body:
          'For first meetings choose a busy public place — a café, mall, park or event venue. Never meet at a private home, and never share your home address with someone you have just met.',
      },
      {
        heading: 'Tell someone',
        body:
          'Let a friend or family member know where you are going, who you are meeting and when you expect to be back. Keep your phone charged.',
      },
      {
        heading: 'Arrange your own transport',
        body: 'Get yourself to and from the meetup so you can leave whenever you want.',
      },
      {
        heading: 'Trust your instincts',
        body:
          'You can leave at any time, for any reason. If someone pressures you, asks for money, or makes you uncomfortable, block and report them.',
      },
      {
        heading: 'Keep it on Patapata at first',
        body:
          'Chat on Patapata until you feel comfortable. Be careful with requests to move quickly to other apps, video calls you did not expect, or "emergencies" that need money.',
      },
      {
        heading: 'In an emergency',
        body:
          'If you are in immediate danger, contact local emergency services first (for example 10111 or 112 from a mobile in South Africa). Then report the person on Patapata so we can act.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: DRAFT,
    sections: [
      {
        heading: 'What we collect',
        body:
          'Your email address, password (stored hashed by our authentication provider), the profile details you choose to add, your date of birth, the content you post and the messages you send. If you turn on distance in Discover, we store an approximate location rounded to about 1 km. We do not collect identity documents.',
      },
      {
        heading: 'Why we use it',
        body:
          'To run Patapata: show your profile and posts to the people you choose, deliver messages, suggest people you may know, keep members safe, and handle reports. Your date of birth is used to confirm you are 18+ and, only if you allow it, to show your age.',
      },
      {
        heading: 'What other members can see',
        body:
          'Your name, username, profile photo and country are visible to signed-in members. Everything else follows your privacy settings. Your exact location, email and date of birth are never shown to other members.',
      },
      {
        heading: 'Messages',
        body:
          'Messages are only visible to the people in the conversation. They are encrypted in transit and stored securely by our hosting provider, but they are not end-to-end encrypted. If you report a message, a moderator sees a copy of that message only.',
      },
      {
        heading: 'No selling of data, no ads',
        body: 'Patapata is free. We do not sell your personal information and we do not show advertising.',
      },
      {
        heading: 'Where your data is stored',
        body:
          'Patapata runs on Supabase (managed PostgreSQL and file storage). The hosting region is chosen at deployment; cross-border transfer safeguards will be documented before launch.',
      },
      {
        heading: 'Retention and deletion',
        body:
          'You can deactivate your account at any time, or ask for it to be deleted. Deletion hides your profile immediately and permanently erases your account, posts, comments, messages and photos after a 14-day grace period in which you can change your mind. Moderation records are kept in minimal form so repeat abuse can be prevented.',
      },
      {
        heading: 'Your rights',
        body:
          'Depending on where you live (for example under POPIA, Nigeria’s NDPA or Kenya’s Data Protection Act), you may have rights to access, correct, delete or object to the use of your information. Contact us to exercise them.',
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    updated: DRAFT,
    sections: [
      {
        heading: 'Free for everyone',
        body:
          'Patapata is free. There are no subscriptions, premium tiers, paid boosts or in-app purchases.',
      },
      {
        heading: 'Eligibility',
        body: 'You must be at least 18 years old and able to agree to these terms where you live.',
      },
      {
        heading: 'Your content',
        body:
          'You own what you post. You give Patapata permission to store and show it to the audience you choose. Only post content you have the right to share.',
      },
      {
        heading: 'Acceptable use',
        body:
          'Follow the Community Guidelines. Do not attempt to access other people’s data, disrupt the service, scrape it, or create accounts automatically.',
      },
      {
        heading: 'Meeting people',
        body:
          'Patapata helps people connect, but we do not run background checks on members. Take care when meeting people and follow our safety guidance.',
      },
      {
        heading: 'Changes and contact',
        body: 'We will tell you about important changes to these terms in the app.',
      },
    ],
  },
};
