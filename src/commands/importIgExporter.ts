import path from 'path';
import fs from 'fs';
import { initDb, insertBenchRun, updateBenchRunFinished, insertProviderResult } from '../db';
import { writeResultsToCsv, writeResultsToJson } from '../csv';
import { parseIgExportCsv, difference, intersection, writeIgUserCsv } from '../igExport';
import { logger } from '../logger';
import { normalizeInstagramUsername } from '../normalize';
import { BenchRun, SocialMetricResult } from '../types';
import { generateReport } from './showReport';

interface ImportOptions {
  target?: string;
  followers?: string;
  following?: string;
}

function usage(): string {
  return [
    'Usage:',
    '  tsx src/index.ts import-ig-export --target <username> --followers <csv> --following <csv>',
    '',
    'Options:',
    '  --target     Instagram profile represented by these exports',
    '  --followers  CSV exported by IG Exporter/Selenium for followers',
    '  --following  CSV exported by IG Exporter/Selenium for following',
    '',
    'At least one of --followers or --following is required.',
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
    } else if (arg === '--followers') {
      options.followers = next;
      i += 1;
    } else if (arg === '--following') {
      options.following = next;
      i += 1;
    }
  }

  return options;
}

function generateRunId(): string {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `ig-export-import-${dateStr}-${randomStr}`;
}

export function importIgExporter(args: string[]): void {
  const startedAt = new Date().toISOString();
  const options = parseArgs(args);

  if (!options.target || (!options.followers && !options.following)) {
    logger.error(usage());
    process.exit(1);
  }

  const normalizedTarget = normalizeInstagramUsername(options.target);
  const followers = options.followers ? parseIgExportCsv(options.followers) : null;
  const following = options.following ? parseIgExportCsv(options.following) : null;

  const followsBack = followers && following ? intersection(following.users, followers.users) : [];
  const notFollowingBack = followers && following ? difference(following.users, followers.users) : [];
  const fansNotFollowedBack = followers && following ? difference(followers.users, following.users) : [];

  const exportsDir = path.join(process.cwd(), 'exports');
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '_');
  const summaryPath = path.join(exportsDir, `${normalizedTarget}_ig_exporter_summary_${timestamp}.json`);
  const notFollowingBackPath = path.join(exportsDir, `${normalizedTarget}_not_following_back_${timestamp}.csv`);
  const fansNotFollowedBackPath = path.join(exportsDir, `${normalizedTarget}_fans_not_followed_back_${timestamp}.csv`);

  fs.mkdirSync(exportsDir, { recursive: true });

  if (followers && following) {
    writeIgUserCsv(notFollowingBack, notFollowingBackPath);
    writeIgUserCsv(fansNotFollowedBack, fansNotFollowedBackPath);
  }

  const raw = {
    source: 'manual CSV import from IG Exporter/Selenium',
    followers: followers
      ? {
          filePath: followers.filePath,
          totalRows: followers.totalRows,
          uniqueUsers: followers.uniqueUsers,
          duplicateRows: followers.duplicateRows,
          skippedRows: followers.skippedRows,
        }
      : null,
    following: following
      ? {
          filePath: following.filePath,
          totalRows: following.totalRows,
          uniqueUsers: following.uniqueUsers,
          duplicateRows: following.duplicateRows,
          skippedRows: following.skippedRows,
        }
      : null,
    overlap: followers && following
      ? {
          followsBackCount: followsBack.length,
          notFollowingBackCount: notFollowingBack.length,
          fansNotFollowedBackCount: fansNotFollowedBack.length,
          notFollowingBackPath,
          fansNotFollowedBackPath,
        }
      : null,
  };

  fs.writeFileSync(summaryPath, JSON.stringify(raw, null, 2), 'utf-8');

  initDb();
  const runId = generateRunId();
  const run: BenchRun = {
    runId,
    startedAt,
    providerCount: 1,
    usernameCount: 1,
    notes: `Manual IG export import for @${normalizedTarget}`,
  };
  insertBenchRun(run);

  const result: SocialMetricResult = {
    provider: 'ig_exporter_manual',
    platform: 'instagram',
    username: options.target,
    normalizedUsername: normalizedTarget,
    followersCount: followers ? followers.uniqueUsers : null,
    followingCount: following ? following.uniqueUsers : null,
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

  logger.success(`Imported IG export for @${normalizedTarget}.`);
  logger.log(`Followers: ${result.followersCount ?? '-'}`);
  logger.log(`Following: ${result.followingCount ?? '-'}`);
  if (followers && following) {
    logger.log(`Following not following back: ${notFollowingBack.length}`);
    logger.log(`Followers you do not follow back: ${fansNotFollowedBack.length}`);
  }
  logger.success(`Summary written to ${summaryPath}`);
}

if (require.main === module) {
  importIgExporter(process.argv.slice(2));
}
