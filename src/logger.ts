import { createConsola } from 'consola';
import { config } from './config';

const rawLogger = createConsola({
  level: config.NODE_ENV === 'test' ? -1 : 3, // -1 is silent, 3 is normal info level
});

/**
 * Replace occurrences of sensitive credentials in a string with a mask.
 */
export function maskSecrets(message: string): string {
  let masked = message;
  
  if (config.META_ACCESS_TOKEN && config.META_ACCESS_TOKEN.length > 3) {
    masked = masked.replace(new RegExp(escapeRegExp(config.META_ACCESS_TOKEN), 'g'), '[META_ACCESS_TOKEN_HIDDEN]');
  }
  if (config.IG_PASSWORD && config.IG_PASSWORD.length > 3) {
    masked = masked.replace(new RegExp(escapeRegExp(config.IG_PASSWORD), 'g'), '[IG_PASSWORD_HIDDEN]');
  }
  
  return masked;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Safe logger that masks secrets before displaying messages.
 */
export const logger = {
  info: (msg: string, ...args: any[]) => {
    rawLogger.info(maskSecrets(msg), ...args.map(a => typeof a === 'string' ? maskSecrets(a) : a));
  },
  warn: (msg: string, ...args: any[]) => {
    rawLogger.warn(maskSecrets(msg), ...args.map(a => typeof a === 'string' ? maskSecrets(a) : a));
  },
  error: (msg: string, ...args: any[]) => {
    rawLogger.error(maskSecrets(msg), ...args.map(a => typeof a === 'string' ? maskSecrets(a) : a));
  },
  debug: (msg: string, ...args: any[]) => {
    rawLogger.debug(maskSecrets(msg), ...args.map(a => typeof a === 'string' ? maskSecrets(a) : a));
  },
  success: (msg: string, ...args: any[]) => {
    rawLogger.success(maskSecrets(msg), ...args.map(a => typeof a === 'string' ? maskSecrets(a) : a));
  },
  log: (msg: string, ...args: any[]) => {
    rawLogger.log(maskSecrets(msg), ...args.map(a => typeof a === 'string' ? maskSecrets(a) : a));
  }
};
