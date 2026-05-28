import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, expect, test } from 'vitest';
import { difference, intersection, parseIgExportCsv } from '../src/igExport';

describe('IG export CSV parsing', () => {
  test('parses Selenium-style exports and deduplicates usernames', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-export-test-'));
    const filePath = path.join(dir, 'followers.csv');
    fs.writeFileSync(
      filePath,
      [
        'username,full_name,is_verified',
        'Alice.Example,Alice,true',
        '@alice.example,Alice duplicate,true',
        'bob_example,Bob,false',
        ',Missing,false',
      ].join('\n'),
      'utf-8',
    );

    const parsed = parseIgExportCsv(filePath);

    expect(parsed.totalRows).toBe(4);
    expect(parsed.uniqueUsers).toBe(2);
    expect(parsed.duplicateRows).toBe(1);
    expect(parsed.skippedRows).toBe(1);
    expect(parsed.users.map((user) => user.username)).toEqual(['alice.example', 'bob_example']);
  });

  test('parses IG Exporter-style headers', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-export-test-'));
    const filePath = path.join(dir, 'following.csv');
    fs.writeFileSync(
      filePath,
      [
        'ID,Username,Full name,Profile picture url,Is verified',
        '1,charlie,Charlie Example,https://example.com/a.jpg,TRUE',
      ].join('\n'),
      'utf-8',
    );

    const parsed = parseIgExportCsv(filePath);

    expect(parsed.uniqueUsers).toBe(1);
    expect(parsed.users[0]).toMatchObject({
      id: '1',
      username: 'charlie',
      fullName: 'Charlie Example',
      profilePicUrl: 'https://example.com/a.jpg',
      isVerified: true,
    });
  });

  test('computes overlap and list differences', () => {
    const left = [
      { username: 'a', raw: {} },
      { username: 'b', raw: {} },
    ];
    const right = [
      { username: 'b', raw: {} },
      { username: 'c', raw: {} },
    ];

    expect(intersection(left, right).map((user) => user.username)).toEqual(['b']);
    expect(difference(left, right).map((user) => user.username)).toEqual(['a']);
  });
});
