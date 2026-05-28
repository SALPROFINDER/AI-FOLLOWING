import { BaseProvider } from './provider.types';
import { ProviderName } from '../types';
import { config } from '../config';

export class DilamePrivateApiProvider extends BaseProvider {
  readonly name: ProviderName = 'dilame_private_api_experimental';

  isEnabled(): boolean {
    return config.ENABLE_RISKY_PROVIDERS && !!(config.IG_USERNAME && config.IG_PASSWORD);
  }

  async fetchInternal(username: string, normalizedUsername: string) {
    if (!config.ENABLE_RISKY_PROVIDERS) {
      return {
        followersCount: null,
        followingCount: null,
        postsCount: null,
        status: 'skipped' as const,
        errorMessage: 'ENABLE_RISKY_PROVIDERS is set to false',
      };
    }

    if (!config.IG_USERNAME || !config.IG_PASSWORD) {
      return {
        followersCount: null,
        followingCount: null,
        postsCount: null,
        status: 'skipped' as const,
        errorMessage: 'Missing credentials for experimental private API (IG_USERNAME or IG_PASSWORD)',
      };
    }

    // Since dilame/instagram-private-api is deprecated and highly unstable on newer Node versions
    // (requires old cryptographic patches, triggers immediate checkpoint challenges, and has high maintenance overhead),
    // we stub it cleanly with 'unsupported' status as allowed in the specifications.
    return {
      followersCount: null,
      followingCount: null,
      postsCount: null,
      status: 'unsupported' as const,
      errorMessage: 'dilame/instagram-private-api is deprecated and prone to TLS handshake errors. Marked as unsupported to preserve account security.',
    };
  }
}
