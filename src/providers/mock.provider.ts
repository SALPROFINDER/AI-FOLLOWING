import { BaseProvider } from './provider.types';
import { ProviderName } from '../types';

export class MockProvider extends BaseProvider {
  readonly name: ProviderName = 'mock';

  isEnabled(): boolean {
    return true;
  }

  async fetchInternal(username: string, normalizedUsername: string) {
    if (normalizedUsername === 'notfound' || normalizedUsername === 'not_found') {
      return {
        followersCount: null,
        followingCount: null,
        postsCount: null,
        status: 'not_found' as const,
        errorMessage: 'User not found (mock trigger)',
      };
    }

    if (normalizedUsername === 'privateuser' || normalizedUsername === 'private_user') {
      return {
        followersCount: null,
        followingCount: null,
        postsCount: null,
        status: 'private' as const,
        errorMessage: 'Private account (mock trigger)',
      };
    }

    // Deterministic hash based on char codes
    let hash = 0;
    for (let i = 0; i < normalizedUsername.length; i++) {
      hash += normalizedUsername.charCodeAt(i);
    }

    const followersCount = (hash * 1234) % 5000000;
    const followingCount = (hash * 43) % 5000;
    const postsCount = (hash * 17) % 800;

    return {
      followersCount,
      followingCount,
      postsCount,
      status: 'success' as const,
      raw: { mock: true, hash },
    };
  }
}
