import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { BenchRun, SocialMetricResult } from './types';
import { logger } from './logger';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'social_metrics.sqlite');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
  }
  return dbInstance;
}

export function initDb(): void {
  const db = getDb();
  
  logger.info(`Initializing SQLite database at: ${DB_PATH}`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bench_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL UNIQUE,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      provider_count INTEGER,
      username_count INTEGER,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS provider_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      platform TEXT NOT NULL,
      username TEXT NOT NULL,
      normalized_username TEXT NOT NULL,
      followers_count INTEGER,
      following_count INTEGER,
      posts_count INTEGER,
      status TEXT NOT NULL,
      error_message TEXT,
      duration_ms INTEGER NOT NULL,
      fetched_at TEXT NOT NULL,
      raw_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES bench_runs(run_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_provider_results_run_id ON provider_results(run_id);
    CREATE INDEX IF NOT EXISTS idx_provider_results_provider ON provider_results(provider);
    CREATE INDEX IF NOT EXISTS idx_provider_results_lookup ON provider_results(platform, normalized_username);
    CREATE INDEX IF NOT EXISTS idx_provider_results_status ON provider_results(status);
  `);
  
  logger.success('Database initialized successfully.');
}

export function insertBenchRun(run: BenchRun): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO bench_runs (run_id, started_at, finished_at, provider_count, username_count, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(run.runId, run.startedAt, run.finishedAt || null, run.providerCount, run.usernameCount, run.notes || null);
}

export function updateBenchRunFinished(runId: string, finishedAt: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE bench_runs SET finished_at = ? WHERE run_id = ?
  `);
  stmt.run(finishedAt, runId);
}

export function insertProviderResult(res: SocialMetricResult, runId: string): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO provider_results (
      run_id, provider, platform, username, normalized_username,
      followers_count, following_count, posts_count, status,
      error_message, duration_ms, fetched_at, raw_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const rawJson = res.raw ? JSON.stringify(res.raw) : null;
  const createdAt = new Date().toISOString();

  stmt.run(
    runId,
    res.provider,
    res.platform,
    res.username,
    res.normalizedUsername,
    res.followersCount,
    res.followingCount,
    res.postsCount,
    res.status,
    res.errorMessage || null,
    res.durationMs,
    res.fetchedAt,
    rawJson,
    createdAt
  );
}

export function getLatestRunId(): string | null {
  const db = getDb();
  const row = db.prepare('SELECT run_id FROM bench_runs ORDER BY id DESC LIMIT 1').get() as { run_id: string } | undefined;
  return row ? row.run_id : null;
}

export function getLatestResults(): SocialMetricResult[] {
  const latestRunId = getLatestRunId();
  if (!latestRunId) return [];
  return getRunResults(latestRunId);
}

export function getRunResults(runId: string): SocialMetricResult[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT provider, platform, username, normalized_username,
           followers_count, following_count, posts_count, status,
           error_message, duration_ms, fetched_at, raw_json
    FROM provider_results
    WHERE run_id = ?
  `).all(runId) as any[];

  return rows.map((r) => ({
    provider: r.provider,
    platform: r.platform,
    username: r.username,
    normalizedUsername: r.normalized_username,
    followersCount: r.followers_count,
    followingCount: r.following_count,
    postsCount: r.posts_count,
    status: r.status,
    errorMessage: r.error_message || undefined,
    durationMs: r.duration_ms,
    fetchedAt: r.fetched_at,
    raw: r.raw_json ? JSON.parse(r.raw_json) : undefined,
  }));
}

export function getLatestRunSummary(): { run: BenchRun; results: SocialMetricResult[] } | null {
  const db = getDb();
  const runRow = db.prepare('SELECT * FROM bench_runs ORDER BY id DESC LIMIT 1').get() as any;
  if (!runRow) return null;

  const run: BenchRun = {
    id: runRow.id,
    runId: runRow.run_id,
    startedAt: runRow.started_at,
    finishedAt: runRow.finished_at,
    providerCount: runRow.provider_count,
    usernameCount: runRow.username_count,
    notes: runRow.notes,
  };

  const results = getRunResults(run.runId);
  return { run, results };
}
