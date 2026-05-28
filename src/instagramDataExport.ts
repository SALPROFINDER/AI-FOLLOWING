import fs from 'fs';
import path from 'path';
import { IgExportUser } from './igExport';
import { normalizeInstagramUsername } from './normalize';

export interface InstagramDataExportParseResult {
  rootPath: string;
  followerFiles: string[];
  followingFiles: string[];
  followers: IgExportUser[];
  following: IgExportUser[];
  skippedEntries: number;
}

function listFilesRecursive(rootPath: string): string[] {
  const absoluteRoot = path.resolve(rootPath);
  const stat = fs.statSync(absoluteRoot);

  if (stat.isFile()) {
    return [absoluteRoot];
  }

  const files: string[] = [];
  for (const entry of fs.readdirSync(absoluteRoot, { withFileTypes: true })) {
    const entryPath = path.join(absoluteRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function isFollowerFile(filePath: string): boolean {
  const basename = path.basename(filePath).toLowerCase();
  return /^followers(?:_\d+)?\.json$/.test(basename);
}

function isFollowingFile(filePath: string): boolean {
  const basename = path.basename(filePath).toLowerCase();
  return basename === 'following.json' || basename === 'relationships_following.json';
}

function entriesFromJson(json: unknown, relationshipKey: string): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    const value = (json as Record<string, unknown>)[relationshipKey];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function usernameFromHref(href: string | undefined): string | undefined {
  if (!href) return undefined;
  const match = href.match(/instagram\.com\/([^/?#]+)/i);
  return match ? match[1] : undefined;
}

function userFromEntry(entry: unknown): IgExportUser | null {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as Record<string, unknown>;
  const stringListData = record.string_list_data;

  if (!Array.isArray(stringListData) || stringListData.length === 0) {
    return null;
  }

  const first = stringListData[0];
  if (!first || typeof first !== 'object') return null;

  const item = first as Record<string, unknown>;
  const value = typeof item.value === 'string' ? item.value : undefined;
  const href = typeof item.href === 'string' ? item.href : undefined;
  const rawUsername = value || usernameFromHref(href);

  if (!rawUsername) return null;

  try {
    return {
      username: normalizeInstagramUsername(rawUsername),
      raw: record,
    };
  } catch {
    return null;
  }
}

function parseRelationshipFiles(filePaths: string[], relationshipKey: string): { users: IgExportUser[]; skipped: number } {
  const seen = new Set<string>();
  const users: IgExportUser[] = [];
  let skipped = 0;

  for (const filePath of filePaths) {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
    const entries = entriesFromJson(json, relationshipKey);

    for (const entry of entries) {
      const user = userFromEntry(entry);
      if (!user) {
        skipped += 1;
        continue;
      }

      if (!seen.has(user.username)) {
        seen.add(user.username);
        users.push(user);
      }
    }
  }

  return { users, skipped };
}

export function parseInstagramDataExport(rootPath: string): InstagramDataExportParseResult {
  const absoluteRoot = path.resolve(rootPath);
  const jsonFiles = listFilesRecursive(absoluteRoot).filter((filePath) => filePath.toLowerCase().endsWith('.json'));
  const followerFiles = jsonFiles.filter(isFollowerFile).sort();
  const followingFiles = jsonFiles.filter(isFollowingFile).sort();

  const followers = parseRelationshipFiles(followerFiles, 'relationships_followers');
  const following = parseRelationshipFiles(followingFiles, 'relationships_following');

  return {
    rootPath: absoluteRoot,
    followerFiles,
    followingFiles,
    followers: followers.users,
    following: following.users,
    skippedEntries: followers.skipped + following.skipped,
  };
}
