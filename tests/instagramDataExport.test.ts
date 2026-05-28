import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, expect, test } from 'vitest';
import { parseInstagramDataExport } from '../src/instagramDataExport';

function relationship(username: string) {
  return {
    title: '',
    media_list_data: [],
    string_list_data: [
      {
        href: `https://www.instagram.com/${username}`,
        value: username,
        timestamp: 1710000000,
      },
    ],
  };
}

describe('Instagram official data export parsing', () => {
  test('finds followers and following JSON files recursively', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'instagram-data-export-test-'));
    const relDir = path.join(root, 'connections', 'followers_and_following');
    fs.mkdirSync(relDir, { recursive: true });

    fs.writeFileSync(
      path.join(relDir, 'followers_1.json'),
      JSON.stringify([relationship('alice'), relationship('bob')]),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(relDir, 'followers_2.json'),
      JSON.stringify([relationship('bob'), relationship('charlie')]),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(relDir, 'following.json'),
      JSON.stringify({
        relationships_following: [relationship('alice'), relationship('diana')],
      }),
      'utf-8',
    );

    const parsed = parseInstagramDataExport(root);

    expect(parsed.followerFiles).toHaveLength(2);
    expect(parsed.followingFiles).toHaveLength(1);
    expect(parsed.followers.map((user) => user.username)).toEqual(['alice', 'bob', 'charlie']);
    expect(parsed.following.map((user) => user.username)).toEqual(['alice', 'diana']);
    expect(parsed.skippedEntries).toBe(0);
  });
});
