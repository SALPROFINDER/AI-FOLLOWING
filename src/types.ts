export type ProviderName =
  | 'mock'
  | 'meta_graph'
  | 'instaloader'
  | 'digitalmethods_batch'
  | 'ig_exporter_manual'
  | 'instagram_data_export'
  | 'instagrapi_experimental'
  | 'dilame_private_api_experimental';

export type ProviderStatus =
  | 'success'
  | 'skipped'
  | 'not_found'
  | 'private'
  | 'rate_limited'
  | 'auth_required'
  | 'error'
  | 'unsupported';

export interface SocialMetricResult {
  provider: ProviderName;
  platform: 'instagram';
  username: string;
  normalizedUsername: string;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number | null;
  status: ProviderStatus;
  errorMessage?: string;
  durationMs: number;
  fetchedAt: string;
  raw?: unknown;
}

export interface BenchRun {
  id?: number;
  runId: string;
  startedAt: string;
  finishedAt?: string | null;
  providerCount: number;
  usernameCount: number;
  notes?: string;
}

export interface UsernameInput {
  platform: 'instagram';
  username: string;
  enabled: boolean;
}
