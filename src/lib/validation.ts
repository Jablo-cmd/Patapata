/**
 * Client-side validation for fast feedback. The database enforces the same
 * rules (and more) server-side; never rely on these alone.
 */

export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
export const MIN_PASSWORD_LENGTH = 10;
export const MIN_AGE = 18;

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Use both letters and numbers.';
  }
  return null;
}

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value);
  if (username.length < 3) return 'Usernames need at least 3 characters.';
  if (username.length > 30) return 'Usernames can be up to 30 characters.';
  if (!USERNAME_PATTERN.test(username)) return 'Use only letters, numbers and underscores.';
  return null;
}

export type BirthDateResult = { ok: true; isoDate: string; age: number } | { ok: false; error: string };

/** Parses a day/month/year entry into an ISO date and age (in UTC). */
export function parseBirthDate(day: string, month: string, year: string, today = new Date()): BirthDateResult {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y) || year.trim().length !== 4) {
    return { ok: false, error: 'Enter your date of birth as DD / MM / YYYY.' };
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return { ok: false, error: 'That date does not exist.' };
  }
  const age = ageOn(date, today);
  if (date.getTime() > today.getTime() || age > 120) {
    return { ok: false, error: 'Enter a valid date of birth.' };
  }
  const isoDate = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { ok: true, isoDate, age };
}

export function ageOn(birth: Date, today = new Date()): number {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Mirrors app.normalize_tags() in the database. */
export function normalizeTags(tags: string[], maxItems = 20): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.replace(/\s+/g, ' ').trim().toLowerCase();
    if (tag.length < 2 || tag.length > 30 || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function splitTags(input: string): string[] {
  return input.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
}
