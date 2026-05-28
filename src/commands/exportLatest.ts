import { getLatestResults } from '../db';
import { writeResultsToCsv, writeResultsToJson } from '../csv';
import { logger } from '../logger';
import path from 'path';

async function run() {
  try {
    const results = getLatestResults();
    if (results.length === 0) {
      logger.warn('No runs found in the database. Please run a benchmark first.');
      process.exit(0);
    }

    const csvPath = path.join(process.cwd(), 'exports', 'latest-results.csv');
    const jsonPath = path.join(process.cwd(), 'exports', 'latest-results.json');

    writeResultsToCsv(results, csvPath);
    writeResultsToJson(results, jsonPath);

    logger.success(`Successfully exported ${results.length} results to:`);
    logger.success(`- CSV: ${csvPath}`);
    logger.success(`- JSON: ${jsonPath}`);
    process.exit(0);
  } catch (err: any) {
    logger.error('Failed to export latest results:', err.message || err);
    process.exit(1);
  }
}

run();
