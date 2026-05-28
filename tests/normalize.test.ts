import { describe, test, expect } from 'vitest';
import { normalizeInstagramUsername } from '../src/normalize';

describe('normalizeInstagramUsername', () => {
  test('should strip leading @ and lowercase and trim', () => {
    expect(normalizeInstagramUsername(' @Nike ')).toBe('nike');
    expect(normalizeInstagramUsername('cristiano')).toBe('cristiano');
  });

  test('should parse full Instagram URLs and extract username', () => {
    expect(normalizeInstagramUsername('https://www.instagram.com/nike/')).toBe('nike');
    expect(normalizeInstagramUsername('instagram.com/nike')).toBe('nike');
    expect(normalizeInstagramUsername('www.instagram.com/nike?hl=fr')).toBe('nike');
    expect(normalizeInstagramUsername('https://instagram.com/therock/?utm_source=ig_embed')).toBe('therock');
  });

  test('should reject URLs with blacklisted paths like /p/, /reel/, etc.', () => {
    expect(() => normalizeInstagramUsername('https://www.instagram.com/p/C-abc123XYZ/')).toThrow();
    expect(() => normalizeInstagramUsername('https://www.instagram.com/reel/C-abc123XYZ/')).toThrow();
    expect(() => normalizeInstagramUsername('https://www.instagram.com/stories/nike/12345/')).toThrow();
    expect(() => normalizeInstagramUsername('instagram.com/explore/locations/')).toThrow();
  });

  test('should reject usernames with invalid characters or spaces', () => {
    expect(() => normalizeInstagramUsername('nike air')).toThrow();
    expect(() => normalizeInstagramUsername('nike!air')).toThrow();
    expect(() => normalizeInstagramUsername('')).toThrow();
    expect(() => normalizeInstagramUsername('  ')).toThrow();
  });
});
