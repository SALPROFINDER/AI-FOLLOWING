import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, expect, test } from 'vitest';
import { parseInstagramDataExport } from '../src/instagramDataExport';
import { generateSimulatedInstagramDataExport } from '../src/simulatedInstagramData';

describe('Simulated Instagram data export', () => {
  test('generates official-export-shaped relationship files', () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'simulated-instagram-data-'));

    const generated = generateSimulatedInstagramDataExport({
      target: 'profilefinder.ai',
      followersCount: 3329,
      followingCount: 256,
      mutualCount: 180,
      outputDir,
    });

    const parsed = parseInstagramDataExport(generated.outputDir);

    expect(generated.followerFiles).toHaveLength(4);
    expect(fs.existsSync(generated.followingFile)).toBe(true);
    expect(parsed.followers).toHaveLength(3329);
    expect(parsed.following).toHaveLength(256);
  });
});
