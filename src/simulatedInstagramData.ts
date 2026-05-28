import fs from 'fs';
import path from 'path';
import { normalizeInstagramUsername } from './normalize';

export interface SimulatedInstagramDataOptions {
  target: string;
  followersCount: number;
  followingCount: number;
  mutualCount: number;
  outputDir: string;
}

export interface SimulatedInstagramDataResult {
  outputDir: string;
  followersCount: number;
  followingCount: number;
  mutualCount: number;
  followerFiles: string[];
  followingFile: string;
}

function relationship(username: string, timestamp: number) {
  return {
    title: '',
    media_list_data: [],
    string_list_data: [
      {
        href: `https://www.instagram.com/${username}`,
        value: username,
        timestamp,
      },
    ],
  };
}

function pad(index: number): string {
  return String(index).padStart(4, '0');
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function generateSimulatedInstagramDataExport(
  options: SimulatedInstagramDataOptions,
): SimulatedInstagramDataResult {
  const target = normalizeInstagramUsername(options.target);
  const followersCount = Math.max(0, Math.floor(options.followersCount));
  const followingCount = Math.max(0, Math.floor(options.followingCount));
  const mutualCount = Math.max(0, Math.min(Math.floor(options.mutualCount), followersCount, followingCount));
  const timestamp = Math.floor(Date.now() / 1000);

  const relationshipDir = path.join(
    options.outputDir,
    'connections',
    'followers_and_following',
  );
  fs.mkdirSync(relationshipDir, { recursive: true });

  const prefix = target.replace(/[^a-z0-9_]/g, '_').slice(0, 12);
  const mutual = Array.from({ length: mutualCount }, (_, i) => `${prefix}_m_${pad(i + 1)}`);
  const followerOnly = Array.from(
    { length: followersCount - mutualCount },
    (_, i) => `${prefix}_fan_${pad(i + 1)}`,
  );
  const followingOnly = Array.from(
    { length: followingCount - mutualCount },
    (_, i) => `${prefix}_out_${pad(i + 1)}`,
  );

  const followers = [...mutual, ...followerOnly].map((username, index) => relationship(username, timestamp - index));
  const following = [...mutual, ...followingOnly].map((username, index) => relationship(username, timestamp - index));

  const followerFiles = chunk(followers, 1000).map((entries, index) => {
    const filePath = path.join(relationshipDir, `followers_${index + 1}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
    return filePath;
  });

  const followingFile = path.join(relationshipDir, 'following.json');
  fs.writeFileSync(
    followingFile,
    JSON.stringify({ relationships_following: following }, null, 2),
    'utf-8',
  );

  fs.writeFileSync(
    path.join(options.outputDir, 'README.txt'),
    [
      `Simulated Instagram data export for @${target}`,
      `Followers: ${followersCount}`,
      `Following: ${followingCount}`,
      `Mutual: ${mutualCount}`,
      '',
      'This fixture mirrors Instagram relationship JSON shape for demos and tests.',
    ].join('\n'),
    'utf-8',
  );

  return {
    outputDir: options.outputDir,
    followersCount,
    followingCount,
    mutualCount,
    followerFiles,
    followingFile,
  };
}
