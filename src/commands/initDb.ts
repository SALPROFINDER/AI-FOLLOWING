import { initDb } from '../db';
import { logger } from '../logger';

async function run() {
  try {
    initDb();
    process.exit(0);
  } catch (err: any) {
    logger.error('Failed to initialize database:', err.message || err);
    process.exit(1);
  }
}

run();
