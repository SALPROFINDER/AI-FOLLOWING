import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { UsernameInput, SocialMetricResult } from './types';
import { normalizeInstagramUsername } from './normalize';
import { logger } from './logger';

const USERNAMES_CSV_PATH = path.join(process.cwd(), 'data', 'usernames.csv');
const EXPORTS_DIR = path.join(process.cwd(), 'exports');

export function loadAndNormalizeUsernames(maxUsernames = 100): { original: string; normalized: string }[] {
  if (!fs.existsSync(USERNAMES_CSV_PATH)) {
    logger.warn(`Usernames CSV file not found at ${USERNAMES_CSV_PATH}. Creating standard one...`);
    fs.mkdirSync(path.dirname(USERNAMES_CSV_PATH), { recursive: true });
    fs.writeFileSync(
      USERNAMES_CSV_PATH,
      'platform,username,enabled\ninstagram,nike,true\ninstagram,adidas,true\ninstagram,instagram,true\ninstagram,cristiano,true\ninstagram,therock,true\n'
    );
  }

  const fileContent = fs.readFileSync(USERNAMES_CSV_PATH, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as { platform: string; username: string; enabled: string }[];

  const seen = new Set<string>();
  const results: { original: string; normalized: string }[] = [];

  for (const record of records) {
    if (record.platform.toLowerCase() !== 'instagram') continue;
    if (record.enabled.toLowerCase() !== 'true') continue;

    try {
      const normalized = normalizeInstagramUsername(record.username);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        results.push({
          original: record.username,
          normalized,
        });
      }
    } catch (err: any) {
      logger.error(`Skipping invalid username '${record.username}' in CSV: ${err.message}`);
    }

    if (results.length >= maxUsernames) {
      logger.info(`Reached limit of max usernames (${maxUsernames}).`);
      break;
    }
  }

  return results;
}

export function writeResultsToCsv(results: SocialMetricResult[], filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const rows = results.map((r) => [
    r.provider,
    r.platform,
    r.username,
    r.normalizedUsername,
    r.followersCount !== null ? r.followersCount : '',
    r.followingCount !== null ? r.followingCount : '',
    r.postsCount !== null ? r.postsCount : '',
    r.status,
    r.errorMessage || '',
    r.durationMs,
    r.fetchedAt,
  ]);

  const csvContent = stringify(rows, {
    header: true,
    columns: [
      'provider',
      'platform',
      'username',
      'normalized_username',
      'followers_count',
      'following_count',
      'posts_count',
      'status',
      'error_message',
      'duration_ms',
      'fetched_at',
    ],
  });

  fs.writeFileSync(filePath, csvContent, 'utf-8');
}

export function writeResultsToJson(results: SocialMetricResult[], filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf-8');
}
