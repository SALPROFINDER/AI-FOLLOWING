import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { BaseProvider } from './provider.types';
import { ProviderName, ProviderStatus } from '../types';
import { config } from '../config';
import { logger } from '../logger';

export class DigitalMethodsProvider extends BaseProvider {
  readonly name: ProviderName = 'digitalmethods_batch';

  isEnabled(): boolean {
    // Enabled if the vendor repo is cloned
    const vendorPath = path.join(process.cwd(), 'vendor', 'instagram-batch-scrape');
    return fs.existsSync(vendorPath);
  }

  async fetchInternal(username: string, normalizedUsername: string) {
    const pythonScript = path.join(process.cwd(), 'python', 'digitalmethods_adapter.py');
    const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python');
    const systemPython = 'python3';
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : systemPython;

    if (!this.isEnabled()) {
      return {
        followersCount: null,
        followingCount: null,
        postsCount: null,
        status: 'skipped' as const,
        errorMessage: 'Vendor directory "vendor/instagram-batch-scrape" not found. Run "scripts/vendor-digitalmethods.sh" to enable.',
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

      const child = execFile(pythonCmd, [pythonScript, normalizedUsername], (error, stdout, stderr) => {
        clearTimeout(processTimeout);

        if (stderr && stderr.trim().length > 0) {
          logger.debug(`DigitalMethods python stderr: ${stderr.trim()}`);
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
