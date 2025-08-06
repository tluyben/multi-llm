import { RetryOptions } from '../types';

export interface RetryConfig {
  retries: number;
  retryInterval: number;
  retryBackoff: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  retries: 1,
  retryInterval: 1000,
  retryBackoff: 2
};

export function getRetryConfig(options: RetryOptions): RetryConfig {
  return {
    retries: options.retries ?? DEFAULT_RETRY_CONFIG.retries,
    retryInterval: options.retryInterval ?? DEFAULT_RETRY_CONFIG.retryInterval,
    retryBackoff: options.retryBackoff ?? DEFAULT_RETRY_CONFIG.retryBackoff
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  context?: string
): Promise<T> {
  let lastError: Error;
  let attempt = 0;
  const maxAttempts = config.retries + 1; // retries + initial attempt

  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      attempt++;

      // If this was the last attempt, throw the error
      if (attempt >= maxAttempts) {
        const contextMsg = context ? ` (${context})` : '';
        throw new Error(`Failed after ${config.retries} retries${contextMsg}: ${lastError.message}`);
      }

      // Calculate delay with exponential backoff
      const delay = config.retryInterval * Math.pow(config.retryBackoff, attempt - 1);
      
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`Retry ${attempt}/${config.retries} after ${delay}ms${context ? ` (${context})` : ''}: ${lastError.message}`);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError!;
}