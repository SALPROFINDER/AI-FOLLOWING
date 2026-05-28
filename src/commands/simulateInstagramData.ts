import path from 'path';
import { generateSimulatedInstagramDataExport } from '../simulatedInstagramData';
import { importInstagramData } from './importInstagramData';
import { logger } from '../logger';
import { normalizeInstagramUsername } from '../normalize';

interface SimulateOptions {
  target?: string;
  followers?: number;
  following?: number;
  mutual?: number;
  output?: string;
}

function usage(): string {
  return [
    'Usage:',
    '  tsx src/index.ts simulate-instagram-data --target <username> [--followers 3329] [--following 256] [--mutual 180]',
    '',
    'Creates an official-export-shaped local fixture, then imports it through the normal pipeline.',
  ].join('\n');
}

function numberArg(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseArgs(args: string[]): SimulateOptions {
  const options: SimulateOptions = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === '--target') {
      options.target = next;
      i += 1;
    } else if (arg === '--followers') {
      options.followers = numberArg(next);
      i += 1;
    } else if (arg === '--following') {
      options.following = numberArg(next);
      i += 1;
    } else if (arg === '--mutual') {
      options.mutual = numberArg(next);
      i += 1;
    } else if (arg === '--output') {
      options.output = next;
      i += 1;
    }
  }

  return options;
}

export function simulateInstagramData(args: string[]): void {
  const options = parseArgs(args);

  if (!options.target) {
    logger.error(usage());
    process.exit(1);
  }

  const target = normalizeInstagramUsername(options.target);
  const followers = options.followers ?? 3329;
  const following = options.following ?? 256;
  const mutual = options.mutual ?? Math.min(180, followers, following);
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '_');
  const outputDir = path.resolve(
    options.output || path.join(process.cwd(), 'exports', 'simulated-instagram-data', `${target}_${timestamp}`),
  );

  const generated = generateSimulatedInstagramDataExport({
    target,
    followersCount: followers,
    followingCount: following,
    mutualCount: mutual,
    outputDir,
  });

  logger.success(`Simulated Instagram data export written to ${generated.outputDir}`);
  logger.log(`Fixture followers: ${generated.followersCount}`);
  logger.log(`Fixture following: ${generated.followingCount}`);
  logger.log(`Fixture mutual: ${generated.mutualCount}`);
  logger.info('Importing simulated export through the normal Instagram data pipeline...');

  importInstagramData(['--target', target, '--path', generated.outputDir]);
}

if (require.main === module) {
  simulateInstagramData(process.argv.slice(2));
}
