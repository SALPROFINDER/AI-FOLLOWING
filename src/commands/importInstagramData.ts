import path from 'path';
import fs from 'fs';
import { initDb, insertBenchRun, updateBenchRunFinished, insertProviderResult } from '../db';
import { writeResultsToCsv, writeResultsToJson } from '../csv';
import { difference, intersection, writeIgUserCsv } from '../igExport';
import { parseInstagramDataExport } from '../instagramDataExport';
import { logger } from '../logger';
import { normalizeInstagramUsername } from '../normalize';
import { BenchRun, SocialMetricResult } from '../types';
import { generateReport } from './showReport';

interface ImportOptions {
  target?: string;
  path?: string;
}

function usage(): string {
  return [
    'Usage:',
    '  tsx src/index.ts import-instagram-data --target <username> --path <extracted-data-folder>',
    '',
    'The folder should be the unzipped Instagram "Download your information" export.',
  ].join('\n');
}

function parseArgs(args: string[]): ImportOptions {
  const options: ImportOptions = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--target') {
      options.target = next;
      i += 1;
    } else if (arg === '--path') {
      options.path = next;
      i += 1;
    }
  }

  return options;
}

function generateRunId(): string {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `instagram-data-import-${dateStr}-${randomStr}`;
}

export function importInstagramData(args: string[]): void {
  const startedAt = new Date().toISOString();
  const options = parseArgs(args);

  if (!options.target || !options.path) {
    logger.error(usage());
    process.exit(1);
  }

  const normalizedTarget = normalizeInstagramUsername(options.target);
  const parsed = parseInstagramDataExport(options.path);

  if (parsed.followerFiles.length === 0 && parsed.followingFiles.length === 0) {
    logger.error(`No followers/following JSON files found under ${parsed.rootPath}`);
    process.exit(1);
  }

  const followsBack = intersection(parsed.following, parsed.followers);
  const notFollowingBack = difference(parsed.following, parsed.followers);
  const fansNotFollowedBack = difference(parsed.followers, parsed.following);

  const exportsDir = path.join(process.cwd(), 'exports');
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '_');
  const summaryPath = path.join(exportsDir, `${normalizedTarget}_instagram_data_summary_${timestamp}.json`);
  const notFollowingBackPath = path.join(exportsDir, `${normalizedTarget}_instagram_data_not_following_back_${timestamp}.csv`);
  const fansNotFollowedBackPath = path.join(exportsDir, `${normalizedTarget}_instagram_data_fans_not_followed_back_${timestamp}.csv`);

  fs.mkdirSync(exportsDir, { recursive: true });
  writeIgUserCsv(notFollowingBack, notFollowingBackPath);
  writeIgUserCsv(fansNotFollowedBack, fansNotFollowedBackPath);

  const raw = {
    source: 'official Instagram data export',
    rootPath: parsed.rootPath,
    followerFiles: parsed.followerFiles,
    followingFiles: parsed.followingFiles,
    followers: {
      uniqueUsers: parsed.followers.length,
    },
    following: {
      uniqueUsers: parsed.following.length,
    },
    skippedEntries: parsed.skippedEntries,
    overlap: {
      followsBackCount: followsBack.length,
      notFollowingBackCount: notFollowingBack.length,
      fansNotFollowedBackCount: fansNotFollowedBack.length,
      notFollowingBackPath,
      fansNotFollowedBackPath,
    },
  };

  fs.writeFileSync(summaryPath, JSON.stringify(raw, null, 2), 'utf-8');

  initDb();
  const runId = generateRunId();
  const run: BenchRun = {
    runId,
    startedAt,
    providerCount: 1,
    usernameCount: 1,
    notes: `Official Instagram data import for @${normalizedTarget}`,
  };
  insertBenchRun(run);

  const result: SocialMetricResult = {
    provider: 'instagram_data_export',
    platform: 'instagram',
    username: options.target,
    normalizedUsername: normalizedTarget,
    followersCount: parsed.followers.length,
    followingCount: parsed.following.length,
    postsCount: null,
    status: 'success',
    durationMs: Date.now() - new Date(startedAt).getTime(),
    fetchedAt: new Date().toISOString(),
    raw,
  };

  insertProviderResult(result, runId);
  updateBenchRunFinished(runId, new Date().toISOString());

  const latestCsvPath = path.join(exportsDir, 'latest-results.csv');
  const latestJsonPath = path.join(exportsDir, 'latest-results.json');
  writeResultsToCsv([result], latestCsvPath);
  writeResultsToJson([result], latestJsonPath);
  generateReport();

  logger.success(`Imported official Instagram data export for @${normalizedTarget}.`);
  logger.log(`Followers: ${result.followersCount}`);
  logger.log(`Following: ${result.followingCount}`);
  logger.log(`Following not following back: ${notFollowingBack.length}`);
  logger.log(`Followers you do not follow back: ${fansNotFollowedBack.length}`);
  logger.success(`Summary written to ${summaryPath}`);
}

if (require.main === module) {
  importInstagramData(process.argv.slice(2));
}
