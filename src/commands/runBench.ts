import { getDb, initDb, insertBenchRun, updateBenchRunFinished, insertProviderResult } from '../db';
import { loadAndNormalizeUsernames, writeResultsToCsv, writeResultsToJson } from '../csv';
import { logger } from '../logger';
import { config } from '../config';
import { ProviderName, SocialMetricResult, BenchRun } from '../types';
import { BaseProvider } from '../providers/provider.types';
import { MockProvider } from '../providers/mock.provider';
import { MetaGraphProvider } from '../providers/metaGraph.provider';
import { InstaloaderProvider } from '../providers/instaloader.provider';
import { DigitalMethodsProvider } from '../providers/digitalMethods.provider';
import { InstagrapiProvider } from '../providers/instagrapi.provider';
import { DilamePrivateApiProvider } from '../providers/dilamePrivateApi.provider';
import { generateReport } from './showReport';
import path from 'path';

// Helper to generate unique run ID
function generateRunId(): string {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `run-${dateStr}-${randomStr}`;
}

export async function runBenchmark(options: { free?: boolean; official?: boolean; risky?: boolean } = {}) {
  // Initialize db just in case
  initDb();

  const allProviders: BaseProvider[] = [
    new MockProvider(),
    new MetaGraphProvider(),
    new InstaloaderProvider(),
    new DigitalMethodsProvider(),
    new InstagrapiProvider(),
    new DilamePrivateApiProvider(),
  ];

  // Determine which providers are active based on CLI flags
  let activeProviders: BaseProvider[] = [];

  if (options.free) {
    activeProviders = allProviders.filter(p => 
      p.name === 'mock' || 
      p.name === 'instaloader' || 
      p.name === 'digitalmethods_batch'
    );
  } else if (options.official) {
    activeProviders = allProviders.filter(p => 
      p.name === 'mock' || 
      p.name === 'meta_graph'
    );
  } else if (options.risky) {
    activeProviders = allProviders; // Runs all including experimental
  } else {
    // Default: run everything except risky ones unless explicitly enabled via env
    activeProviders = allProviders.filter(p => {
      if (p.name === 'instagrapi_experimental' || p.name === 'dilame_private_api_experimental') {
        return config.ENABLE_RISKY_PROVIDERS;
      }
      return true;
    });
  }

  // Load and normalize usernames
  logger.info(`Loading usernames with max limit = ${config.MAX_USERNAMES}...`);
  const targets = loadAndNormalizeUsernames(config.MAX_USERNAMES);
  if (targets.length === 0) {
    logger.warn('No active usernames found to benchmark. Please check data/usernames.csv.');
    return;
  }

  logger.info(`Found ${targets.length} unique normalized usernames.`);
  
  // Log running providers
  logger.log('\nRunning providers:');
  for (const p of allProviders) {
    const isActive = activeProviders.some(ap => ap.name === p.name);
    let statusText = 'disabled';
    
    if (isActive) {
      if (p.name === 'digitalmethods_batch' && !p.isEnabled()) {
        statusText = 'skipped unless vendor installed';
      } else if (p.name === 'meta_graph' && !p.isEnabled()) {
        statusText = 'skipped, missing env';
      } else if ((p.name === 'instagrapi_experimental' || p.name === 'dilame_private_api_experimental') && !config.ENABLE_RISKY_PROVIDERS) {
        statusText = 'skipped, risky disabled';
      } else {
        statusText = 'enabled';
      }
    }
    logger.log(`- ${p.name}: ${statusText}`);
  }
  logger.log('');

  const runId = generateRunId();
  const startedAt = new Date().toISOString();

  const run: BenchRun = {
    runId,
    startedAt,
    providerCount: activeProviders.length,
    usernameCount: targets.length,
    notes: `CLI flags: ${JSON.stringify(options)}`,
  };

  insertBenchRun(run);
  logger.info(`Starting benchmark run ${runId}...`);

  const results: SocialMetricResult[] = [];
  let isFirstLiveRequest = true;

  // Outer loop: providers (helps run sequentially and keep delays clean)
  for (const provider of activeProviders) {
    logger.info(`[Provider: ${provider.name}] starting metric extraction...`);
    
    for (const target of targets) {
      // Apply delay for live scraping providers (exclude mock or skipped providers)
      const needsDelay = provider.name !== 'mock' && provider.isEnabled();
      if (needsDelay) {
        if (!isFirstLiveRequest) {
          logger.debug(`Waiting ${config.REQUEST_DELAY_MS}ms to respect request delay...`);
          await new Promise(resolve => setTimeout(resolve, config.REQUEST_DELAY_MS));
        }
        isFirstLiveRequest = false;
      }

      logger.info(`Fetching ${target.normalized} via ${provider.name}...`);
      const result = await provider.fetch(target.original, target.normalized);
      
      insertProviderResult(result, runId);
      results.push(result);
      
      logger.success(`Fetched ${target.normalized} via ${provider.name} in ${result.durationMs}ms [Status: ${result.status}]`);
    }
  }

  const finishedAt = new Date().toISOString();
  updateBenchRunFinished(runId, finishedAt);
  logger.success(`\nBenchmark run ${runId} finished at ${finishedAt}.`);

  // Display terminal table
  printTerminalTable(results);

  // Export results
  const csvPath = path.join(process.cwd(), 'exports', 'latest-results.csv');
  const jsonPath = path.join(process.cwd(), 'exports', 'latest-results.json');
  
  writeResultsToCsv(results, csvPath);
  writeResultsToJson(results, jsonPath);
  logger.success(`Results exported to ${csvPath} and ${jsonPath}.`);

  // Generate Report
  logger.info('Generating provider comparison report...');
  generateReport();
}

function printTerminalTable(results: SocialMetricResult[]) {
  // Define column widths
  const widths = {
    provider: 24,
    username: 15,
    followers: 12,
    following: 12,
    posts: 8,
    status: 12,
    duration: 8,
  };

  const header = 
    'Provider'.padEnd(widths.provider) + ' | ' +
    'Username'.padEnd(widths.username) + ' | ' +
    'Followers'.padEnd(widths.followers) + ' | ' +
    'Following'.padEnd(widths.following) + ' | ' +
    'Posts'.padEnd(widths.posts) + ' | ' +
    'Status'.padEnd(widths.status) + ' | ' +
    'Duration';

  const separator = '-'.repeat(header.length);

  console.log('\nResults:');
  console.log(separator);
  console.log(header);
  console.log(separator);

  for (const r of results) {
    const followers = r.followersCount !== null ? String(r.followersCount) : '-';
    const following = r.followingCount !== null ? String(r.followingCount) : '-';
    const posts = r.postsCount !== null ? String(r.postsCount) : '-';
    const duration = `${r.durationMs}ms`;

    const row = 
      r.provider.padEnd(widths.provider) + ' | ' +
      r.username.padEnd(widths.username) + ' | ' +
      followers.padEnd(widths.followers) + ' | ' +
      following.padEnd(widths.following) + ' | ' +
      posts.padEnd(widths.posts) + ' | ' +
      r.status.padEnd(widths.status) + ' | ' +
      duration;
    
    console.log(row);
  }
  console.log(separator + '\n');
}

// If executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    free: args.includes('--free'),
    official: args.includes('--official'),
    risky: args.includes('--risky'),
  };
  runBenchmark(options);
}
