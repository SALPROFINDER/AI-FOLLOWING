import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { BaseProvider } from './provider.types';
import { ProviderName, ProviderStatus } from '../types';
import { config } from '../config';
import { logger } from '../logger';

export class InstagrapiProvider extends BaseProvider {
  readonly name: ProviderName = 'instagrapi_experimental';

  isEnabled(): boolean {
    return config.ENABLE_RISKY_PROVIDERS && !!(config.IG_USERNAME && config.IG_PASSWORD);
  }

  async fetchInternal(username: string, normalizedUsername: string) {
    const pythonScript = path.join(process.cwd(), 'python', 'instagrapi_adapter.py');
    const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python');
    const systemPython = 'python3';
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : systemPython;

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

    return new Promise<any>((resolve) => {
      const processTimeout = setTimeout(() => {
        child.kill();
        resolve({
          followersCount: null,
          followingCount: null,
          postsCount: null,
          status: 'error',
          errorMessage: `Python adapter execution timed out after ${config.PROVIDER_TIMEOUT_MS}ms`,
        });
      }, config.PROVIDER_TIMEOUT_MS);

      // Pass credentials to child env
      const childEnv = {
        ...process.env,
        ENABLE_RISKY_PROVIDERS: String(config.ENABLE_RISKY_PROVIDERS),
        IG_USERNAME: config.IG_USERNAME,
        IG_PASSWORD: config.IG_PASSWORD,
      };

      const child = execFile(pythonCmd, [pythonScript, normalizedUsername], { env: childEnv }, (error, stdout, stderr) => {
        clearTimeout(processTimeout);

        if (stderr && stderr.trim().length > 0) {
          logger.debug(`Instagrapi python stderr: ${stderr.trim()}`);
        }

        if (error && !stdout) {
          return resolve({
            followersCount: null,
            followingCount: null,
            postsCount: null,
            status: 'error',
            errorMessage: `Python execution error: ${error.message}`,
          });
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          resolve({
            followersCount: parsed.followersCount,
            followingCount: parsed.followingCount,
            postsCount: parsed.postsCount,
            status: parsed.status as ProviderStatus,
            errorMessage: parsed.errorMessage || undefined,
            raw: parsed.raw,
          });
        } catch (parseErr: any) {
          resolve({
            followersCount: null,
            followingCount: null,
            postsCount: null,
            status: 'error',
            errorMessage: `Failed to parse Python script output: ${parseErr.message}. Output was: ${stdout}`,
          });
        }
      });
    });
  }
}
