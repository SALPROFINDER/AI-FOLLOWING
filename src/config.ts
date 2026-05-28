import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Meta official provider
  META_ACCESS_TOKEN: z.string().optional().or(z.literal('')),
  META_IG_USER_ID: z.string().optional().or(z.literal('')),
  META_GRAPH_API_VERSION: z.string().default('v25.0'),

  // Experimental risky providers
  ENABLE_RISKY_PROVIDERS: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .default('false'),
  IG_USERNAME: z.string().optional().or(z.literal('')),
  IG_PASSWORD: z.string().optional().or(z.literal('')),

  // Runner settings
  REQUEST_DELAY_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('5000'),
  PROVIDER_TIMEOUT_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('30000'),
  MAX_USERNAMES: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('10'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

/**
 * Returns a sanitized copy of the config for logging, masking secrets.
 */
export function getSanitizedConfig() {
  return {
    ...config,
    META_ACCESS_TOKEN: config.META_ACCESS_TOKEN ? '***' : undefined,
    IG_PASSWORD: config.IG_PASSWORD ? '***' : undefined,
  };
}
