import { BaseProvider } from './provider.types';
import { ProviderName, ProviderStatus } from '../types';
import { config } from '../config';
import { logger } from '../logger';

export class MetaGraphProvider extends BaseProvider {
  readonly name: ProviderName = 'meta_graph';

  isEnabled(): boolean {
    return !!(config.META_ACCESS_TOKEN && config.META_IG_USER_ID);
  }

  async fetchInternal(username: string, normalizedUsername: string) {
    if (!this.isEnabled()) {
      return {
        followersCount: null,
        followingCount: null,
        postsCount: null,
        status: 'skipped' as const,
        errorMessage: 'Missing Meta Graph API credentials (META_ACCESS_TOKEN or META_IG_USER_ID)',
      };
    }

    const version = config.META_GRAPH_API_VERSION;
    const igUserId = config.META_IG_USER_ID;
    const token = config.META_ACCESS_TOKEN;

    const url = `https://graph.facebook.com/${version}/${igUserId}?fields=business_discovery.username(${normalizedUsername}){username,followers_count,follows_count,media_count}&access_token=${token}`;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(config.PROVIDER_TIMEOUT_MS) });
      const data = await response.json() as any;

      if (data.error) {
        const err = data.error;
        const errMsg = err.message || 'Meta API error';
        const code = err.code;
        const subcode = err.error_subcode;

        logger.error(`Meta API error response: code=${code}, subcode=${subcode}, message=${errMsg}`);

        let status: ProviderStatus = 'error';
        if (code === 4 || code === 17 || code === 32 || code === 613) {
          status = 'rate_limited';
        } else if (code === 102 || code === 190) {
          status = 'auth_required';
        } else if (subcode === 2207013) {
          // Username is not a business account
          status = 'unsupported';
        } else if (subcode === 2207001 || errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('does not exist')) {
          status = 'not_found';
        }

        return {
          followersCount: null,
          followingCount: null,
          postsCount: null,
          status,
          errorMessage: `${err.type || 'OAuthException'} (Code ${code}, Sub ${subcode}): ${errMsg}`,
          raw: data,
        };
      }

      const discovery = data.business_discovery;
      if (!discovery) {
        return {
          followersCount: null,
          followingCount: null,
          postsCount: null,
          status: 'error' as const,
          errorMessage: 'Missing business_discovery data in Meta API response',
          raw: data,
        };
      }

      return {
        followersCount: typeof discovery.followers_count === 'number' ? discovery.followers_count : null,
        followingCount: typeof discovery.follows_count === 'number' ? discovery.follows_count : null,
        postsCount: typeof discovery.media_count === 'number' ? discovery.media_count : null,
        status: 'success' as const,
        raw: data,
      };
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        return {
          followersCount: null,
          followingCount: null,
          postsCount: null,
          status: 'error' as const,
          errorMessage: `Meta API request timed out after ${config.PROVIDER_TIMEOUT_MS}ms`,
        };
      }
      return {
        followersCount: null,
        followingCount: null,
        postsCount: null,
        status: 'error' as const,
        errorMessage: `Network error: ${err.message || err}`,
      };
    }
  }
}
