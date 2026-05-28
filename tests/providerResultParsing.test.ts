import { describe, test, expect } from 'vitest';
import { z } from 'zod';

const pyOutputSchema = z.object({
  provider: z.string(),
  platform: z.literal('instagram'),
  username: z.string(),
  followersCount: z.number().nullable(),
  followingCount: z.number().nullable(),
  postsCount: z.number().nullable(),
  status: z.enum([
    'success',
    'skipped',
    'not_found',
    'private',
    'rate_limited',
    'auth_required',
    'error',
    'unsupported'
  ]),
  errorMessage: z.string().nullable().optional(),
  raw: z.record(z.any()).optional(),
});

describe('Python Adapter Result Parsing', () => {
  test('should parse success output', () => {
    const rawStdout = `
      {
        "provider": "instaloader",
        "platform": "instagram",
        "username": "nike",
        "followersCount": 123456,
        "followingCount": 420,
        "postsCount": 900,
        "status": "success",
        "errorMessage": null,
        "raw": {"is_private": false}
      }
    `;

    const parsed = pyOutputSchema.parse(JSON.parse(rawStdout.trim()));
    expect(parsed.provider).toBe('instaloader');
    expect(parsed.followersCount).toBe(123456);
    expect(parsed.status).toBe('success');
    expect(parsed.errorMessage).toBeNull();
  });

  test('should parse error output', () => {
    const rawStdout = `
      {
        "provider": "instaloader",
        "platform": "instagram",
        "username": "nike",
        "followersCount": null,
        "followingCount": null,
        "postsCount": null,
        "status": "rate_limited",
        "errorMessage": "Rate limited",
        "raw": {}
      }
    `;

    const parsed = pyOutputSchema.parse(JSON.parse(rawStdout.trim()));
    expect(parsed.status).toBe('rate_limited');
    expect(parsed.followersCount).toBeNull();
    expect(parsed.errorMessage).toBe('Rate limited');
  });
});
