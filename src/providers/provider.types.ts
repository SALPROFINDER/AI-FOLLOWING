import { ProviderName, SocialMetricResult, ProviderStatus } from '../types';

export abstract class BaseProvider {
  abstract readonly name: ProviderName;

  /**
   * Checks whether the provider is configured and enabled in the environment.
   */
  abstract isEnabled(): boolean;

  /**
   * Primary method to execute the provider's metric collection.
   */
  abstract fetchInternal(username: string, normalizedUsername: string): Promise<Omit<SocialMetricResult, 'provider' | 'platform' | 'username' | 'normalizedUsername' | 'durationMs' | 'fetchedAt'>>;

  /**
   * Public interface wrapper that records the duration of the fetch and structures the result.
   */
  async fetch(username: string, normalizedUsername: string): Promise<SocialMetricResult> {
    const startedAt = new Date().toISOString();
    const startTime = performance.now();

    try {
      if (!this.isEnabled()) {
        const duration = Math.round(performance.now() - startTime);
        return {
          provider: this.name,
          platform: 'instagram',
          username,
          normalizedUsername,
          followersCount: null,
          followingCount: null,
          postsCount: null,
          status: 'skipped',
          errorMessage: 'Provider is not enabled/configured',
          durationMs: duration,
          fetchedAt: startedAt,
        };
      }

      const internalResult = await this.fetchInternal(username, normalizedUsername);
      const duration = Math.round(performance.now() - startTime);

      return {
        provider: this.name,
        platform: 'instagram',
        username,
        normalizedUsername,
        followersCount: internalResult.followersCount,
        followingCount: internalResult.followingCount,
        postsCount: internalResult.postsCount,
        status: internalResult.status,
        errorMessage: internalResult.errorMessage,
        durationMs: duration,
        fetchedAt: startedAt,
        raw: internalResult.raw,
      };
    } catch (err: any) {
      const duration = Math.round(performance.now() - startTime);
      return {
        provider: this.name,
        platform: 'instagram',
        username,
        normalizedUsername,
        followersCount: null,
        followingCount: null,
        postsCount: null,
        status: 'error',
        errorMessage: err.message || 'Unknown provider error',
        durationMs: duration,
        fetchedAt: startedAt,
      };
    }
  }
}
