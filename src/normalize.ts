import { z } from 'zod';

const BLACKLISTED_SEGMENTS = new Set([
  'p',
  'reel',
  'reels',
  'stories',
  'tv',
  'explore',
  'direct',
  'developer',
  'about',
  'blog',
  'press',
  'api',
  'jobs',
  'privacy',
  'terms',
  'directory',
  'channels',
]);

const instagramUsernameRegex = /^[a-z0-9._]+$/;

export function normalizeInstagramUsername(input: string): string {
  if (!input) {
    throw new Error('Username input cannot be empty');
  }

  let cleaned = input.trim();

  // Strip leading '@' if present
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.slice(1);
  }

  // Check if it's a URL
  const isUrl = cleaned.includes('instagram.com');
  let usernameCandidate = cleaned;

  if (isUrl) {
    let urlString = cleaned;
    if (!/^https?:\/\//i.test(urlString)) {
      urlString = 'https://' + urlString;
    }

    try {
      const url = new URL(urlString);
      const pathname = url.pathname;
      const segments = pathname.split('/').filter(Boolean);

      if (segments.length === 0) {
        throw new Error('Invalid Instagram URL: no path segment found');
      }

      const firstSegment = segments[0].toLowerCase();
      
      if (BLACKLISTED_SEGMENTS.has(firstSegment)) {
        throw new Error(`Invalid Instagram username or URL: path contains blacklisted segment '${firstSegment}'`);
      }

      usernameCandidate = segments[0];
    } catch (err: any) {
      throw new Error(err.message || 'Invalid Instagram URL');
    }
  }

  // Final cleaning: lowercase
  usernameCandidate = usernameCandidate.toLowerCase();

  // Check if contains spaces
  if (/\s/.test(usernameCandidate)) {
    throw new Error('Username cannot contain spaces');
  }

  // Validate characters
  if (!instagramUsernameRegex.test(usernameCandidate)) {
    throw new Error('Username contains invalid characters (only letters, numbers, periods, and underscores allowed)');
  }

  // Use Zod to double-check and return
  const schema = z.string().min(1).max(30);
  return schema.parse(usernameCandidate);
}
