import { MockProvider } from '../src/providers/mock.provider';
import { MetaGraphProvider } from '../src/providers/metaGraph.provider';
import { InstaloaderProvider } from '../src/providers/instaloader.provider';
import { DigitalMethodsProvider } from '../src/providers/digitalMethods.provider';
import { InstagrapiProvider } from '../src/providers/instagrapi.provider';
import { DilamePrivateApiProvider } from '../src/providers/dilamePrivateApi.provider';
import { BaseProvider } from '../src/providers/provider.types';
import { normalizeInstagramUsername } from '../src/normalize';
import { logger } from '../src/logger';

const allProviders: Record<string, BaseProvider> = {
  mock: new MockProvider(),
  meta_graph: new MetaGraphProvider(),
  instaloader: new InstaloaderProvider(),
  digitalmethods_batch: new DigitalMethodsProvider(),
  instagrapi_experimental: new InstagrapiProvider(),
  dilame_private_api_experimental: new DilamePrivateApiProvider(),
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: tsx scripts/run-single-provider.ts <provider-name> <username>');
    console.log('Providers:', Object.keys(allProviders).join(', '));
    process.exit(1);
  }

  const [providerName, username] = args;
  const provider = allProviders[providerName];

  if (!provider) {
    logger.error(`Unknown provider: ${providerName}`);
    process.exit(1);
  }

  try {
    const normalized = normalizeInstagramUsername(username);
    logger.info(`Running ${providerName} on ${username} (normalized: ${normalized})...`);
    
    const result = await provider.fetch(username, normalized);
    
    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    logger.error(`Failed to run provider: ${err.message || err}`);
    process.exit(1);
  }
}

main();
