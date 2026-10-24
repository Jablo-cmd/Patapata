import { describe, expect, it } from 'vitest';

import { errorCode, friendlyError } from '@/lib/errors';
import { formatCount, initials, relativeTime } from '@/lib/format';
import {
  ageOn,
  normalizeTags,
  normalizeUsername,
  parseBirthDate,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@/lib/validation';

describe('validation', () => {
  it('validates emails', () => {
    expect(validateEmail('thandi@example.co.za')).toBeNull();
    expect(validateEmail('not-an-email')).not.toBeNull();
    expect(validateEmail('')).not.toBeNull();
  });

  it('requires strong passwords', () => {
    expect(validatePassword('short1')).toMatch(/10 characters/);
    expect(validatePassword('onlyletters')).toMatch(/letters and numbers/);
    expect(validatePassword('letters1234')).toBeNull();
  });

  it('normalises and validates usernames', () => {
    expect(normalizeUsername(' @Kwame_A ')).toBe('kwame_a');
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('kwame-a')).not.toBeNull();
    expect(validateUsername('kwame_a')).toBeNull();
  });

  it('parses birth dates and computes age around birthdays', () => {
    const today = new Date(Date.UTC(2026, 9, 24));
    expect(parseBirthDate('24', '10', '2008', today)).toEqual({ ok: true, isoDate: '2008-10-24', age: 18 });
    expect(parseBirthDate('25', '10', '2008', today)).toMatchObject({ ok: true, age: 17 });
    expect(parseBirthDate('31', '02', '2000', today)).toMatchObject({ ok: false });
    expect(parseBirthDate('01', '01', '30', today)).toMatchObject({ ok: false });
    expect(parseBirthDate('01', '01', '2030', today)).toMatchObject({ ok: false });
    expect(ageOn(new Date(Date.UTC(2000, 1, 29)), new Date(Date.UTC(2018, 1, 28)))).toBe(17);
  });

  it('normalises tags like the database does', () => {
    expect(normalizeTags(['Football', ' football ', 'a', 'Jollof  Rice'])).toEqual(['football', 'jollof rice']);
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `tag${i}`), 20)).toHaveLength(20);
  });
});

describe('formatting', () => {
  const now = Date.UTC(2026, 9, 24, 12);
  it('formats relative times', () => {
    expect(relativeTime(new Date(now - 30_000).toISOString(), now)).toBe('now');
    expect(relativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5m');
    expect(relativeTime(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe('3h');
    expect(relativeTime(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe('2d');
  });
  it('formats counts and initials', () => {
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1500)).toBe('1.5k');
    expect(formatCount(25_000)).toBe('25k');
    expect(initials('Nomvula Dlamini')).toBe('ND');
    expect(initials('')).toBe('?');
  });
});

describe('error messages', () => {
  it('maps database error codes to friendly text', () => {
    expect(errorCode({ message: 'rate_limited: too many post actions' })).toBe('rate_limited');
    expect(friendlyError({ message: 'username_unavailable' })).toMatch(/not available/);
    expect(friendlyError({ code: 'email_not_confirmed', message: 'Email not confirmed' })).toMatch(/verify/);
    expect(friendlyError({ message: 'Network request failed' })).toMatch(/offline/);
    expect(friendlyError({ message: 'something odd' })).toMatch(/went wrong/);
  });
});
