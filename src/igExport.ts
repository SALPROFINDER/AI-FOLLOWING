import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { normalizeInstagramUsername } from './normalize';

export interface IgExportUser {
  username: string;
  fullName?: string;
  id?: string;
  isVerified?: boolean;
  isPrivate?: boolean;
  profilePicUrl?: string;
  raw: Record<string, unknown>;
}

export interface IgExportParseResult {
  filePath: string;
  totalRows: number;
  uniqueUsers: number;
  duplicateRows: number;
  skippedRows: number;
  users: IgExportUser[];
}

const headerAliases: Record<string, string> = {
  id: 'id',
  userid: 'id',
  userpk: 'id',
  pk: 'id',
  username: 'username',
  user: 'username',
  handle: 'username',
  profileusername: 'username',
  igusername: 'username',
  fullname: 'fullName',
  name: 'fullName',
  displayname: 'fullName',
  profilepictureurl: 'profilePicUrl',
  profilepicurl: 'profilePicUrl',
  avatar: 'profilePicUrl',
  isverified: 'isVerified',
  verified: 'isVerified',
  isprivate: 'isPrivate',
  private: 'isPrivate',
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valueFor(row: Record<string, unknown>, canonicalName: string): string | undefined {
  for (const [header, value] of Object.entries(row)) {
    const mapped = headerAliases[normalizeHeader(header)];
    if (mapped === canonicalName && value !== undefined && value !== null) {
      const asString = String(value).trim();
      if (asString.length > 0) return asString;
    }
  }
  return undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return undefined;
}

export function parseIgExportCsv(filePath: string): IgExportParseResult {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, unknown>[];

  const seen = new Set<string>();
  const users: IgExportUser[] = [];
  let duplicateRows = 0;
  let skippedRows = 0;

  for (const record of records) {
    const rawUsername = valueFor(record, 'username');
    if (!rawUsername) {
      skippedRows += 1;
      continue;
    }

    let username: string;
    try {
      username = normalizeInstagramUsername(rawUsername);
    } catch {
      skippedRows += 1;
      continue;
    }

    if (seen.has(username)) {
      duplicateRows += 1;
      continue;
    }

    seen.add(username);
    users.push({
      username,
      fullName: valueFor(record, 'fullName'),
      id: valueFor(record, 'id'),
      isVerified: parseBoolean(valueFor(record, 'isVerified')),
      isPrivate: parseBoolean(valueFor(record, 'isPrivate')),
      profilePicUrl: valueFor(record, 'profilePicUrl'),
      raw: record,
    });
  }

  return {
    filePath: absolutePath,
    totalRows: records.length,
    uniqueUsers: users.length,
    duplicateRows,
    skippedRows,
    users,
  };
}

export function writeIgUserCsv(users: IgExportUser[], filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const rows = users.map((user) => ({
    username: user.username,
    full_name: user.fullName || '',
    id: user.id || '',
    is_verified: user.isVerified ?? '',
    is_private: user.isPrivate ?? '',
    profile_pic_url: user.profilePicUrl || '',
  }));

  fs.writeFileSync(
    filePath,
    stringify(rows, {
      header: true,
      columns: ['username', 'full_name', 'id', 'is_verified', 'is_private', 'profile_pic_url'],
    }),
    'utf-8',
  );
}

export function difference(left: IgExportUser[], right: IgExportUser[]): IgExportUser[] {
  const rightUsernames = new Set(right.map((user) => user.username));
  return left.filter((user) => !rightUsernames.has(user.username));
}

export function intersection(left: IgExportUser[], right: IgExportUser[]): IgExportUser[] {
  const rightUsernames = new Set(right.map((user) => user.username));
  return left.filter((user) => rightUsernames.has(user.username));
}
