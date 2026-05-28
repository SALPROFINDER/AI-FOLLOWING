import { runBenchmark } from './commands/runBench';
import { importIgExporter } from './commands/importIgExporter';
import { importInstagramData } from './commands/importInstagramData';
import { simulateInstagramData } from './commands/simulateInstagramData';
import { logger } from './logger';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'bench') {
    const options = {
      free: args.includes('--free'),
      official: args.includes('--official'),
      risky: args.includes('--risky'),
    };
    
    try {
      await runBenchmark(options);
    } catch (err: any) {
      logger.error('Error running benchmark:', err.message || err);
      process.exit(1);
    }
  } else if (command === 'import-ig-export') {
    try {
      importIgExporter(args.slice(1));
    } catch (err: any) {
      logger.error('Error importing IG export:', err.message || err);
      process.exit(1);
    }
  } else if (command === 'import-instagram-data') {
    try {
      importInstagramData(args.slice(1));
    } catch (err: any) {
      logger.error('Error importing Instagram data export:', err.message || err);
      process.exit(1);
    }
  } else if (command === 'simulate-instagram-data') {
    try {
      simulateInstagramData(args.slice(1));
    } catch (err: any) {
      logger.error('Error simulating Instagram data export:', err.message || err);
      process.exit(1);
    }
  } else {
    logger.log('Instagram Count Provider Bench CLI');
    logger.log('Usage:');
    logger.log('  tsx src/index.ts bench [options]');
    logger.log('  tsx src/index.ts import-ig-export --target <username> [--followers <csv>] [--following <csv>]');
    logger.log('  tsx src/index.ts import-instagram-data --target <username> --path <extracted-data-folder>');
    logger.log('  tsx src/index.ts simulate-instagram-data --target <username> [--followers 3329] [--following 256]');
    logger.log('Options:');
    logger.log('  --free        Run only mock + instaloader + digitalmethods');
    logger.log('  --official    Run only mock + meta_graph');
    logger.log('  --risky       Run all including experimental private APIs');
    logger.log('\nUse NPM commands directly for a smoother workflow (e.g. npm run bench:free)');
    process.exit(0);
  }
}

main();
