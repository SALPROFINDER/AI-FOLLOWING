import { describe, test, expect, beforeAll } from 'vitest';
import { initDb, getDb, insertBenchRun, insertProviderResult, getLatestRunSummary } from '../src/db';
import { BenchRun, SocialMetricResult } from '../src/types';

describe('SQLite Storage (Cache)', () => {
  beforeAll(() => {
    // Set node env to test to silence logger and let config know
    process.env.NODE_ENV = 'test';
    initDb();
  });

  test('should insert and fetch a benchmark run', () => {
    const runId = `test-run-${Date.now()}`;
    const run: BenchRun = {
      runId,
      startedAt: new Date().toISOString(),
      providerCount: 2,
      usernameCount: 3,
      notes: 'Test run notes',
    };

    insertBenchRun(run);

    const result: SocialMetricResult = {
      provider: 'mock',
      platform: 'instagram',
      username: 'adidas',
      normalizedUsername: 'adidas',
      followersCount: 1500,
      followingCount: 300,
      postsCount: 50,
      status: 'success',
      durationMs: 12,
      fetchedAt: new Date().toISOString(),
    };

    insertProviderResult(result, runId);

    const summary = getLatestRunSummary();
    expect(summary).not.toBeNull();
    expect(summary!.run.runId).toBe(runId);
    expect(summary!.results.length).toBe(1);
    expect(summary!.results[0].username).toBe('adidas');
    expect(summary!.results[0].followersCount).toBe(1500);
  });
});
