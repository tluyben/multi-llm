import { MultiLLM } from '../src/index';
import { executeWithRetry, getRetryConfig, sleep } from '../src/utils/retry';
import { checkEnvironmentVariables, TEST_CONFIG } from './setup';

describe('Retry Functionality Tests', () => {
  describe('Retry Configuration', () => {
    test('should use default retry configuration', () => {
      const config = getRetryConfig({});
      
      expect(config.retries).toBe(1);
      expect(config.retryInterval).toBe(1000);
      expect(config.retryBackoff).toBe(2);
    });

    test('should override default retry configuration', () => {
      const config = getRetryConfig({
        retries: 3,
        retryInterval: 500,
        retryBackoff: 1.5
      });
      
      expect(config.retries).toBe(3);
      expect(config.retryInterval).toBe(500);
      expect(config.retryBackoff).toBe(1.5);
    });

    test('should handle partial retry configuration', () => {
      const config = getRetryConfig({
        retries: 2
      });
      
      expect(config.retries).toBe(2);
      expect(config.retryInterval).toBe(1000); // default
      expect(config.retryBackoff).toBe(2); // default
    });
  });

  describe('Sleep Utility', () => {
    test('should sleep for specified duration', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      
      // Allow for some timing variance
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('Execute With Retry', () => {
    test('should succeed on first attempt', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        return 'success';
      };

      const result = await executeWithRetry(operation, { retries: 2, retryInterval: 10, retryBackoff: 2 });
      
      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    test('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success after retries';
      };

      const result = await executeWithRetry(
        operation, 
        { retries: 3, retryInterval: 10, retryBackoff: 2 }
      );
      
      expect(result).toBe('success after retries');
      expect(attempts).toBe(3);
    });

    test('should fail after exhausting all retries', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Persistent failure');
      };

      await expect(executeWithRetry(
        operation,
        { retries: 2, retryInterval: 10, retryBackoff: 2 },
        'test-context'
      )).rejects.toThrow('Failed after 2 retries (test-context): Persistent failure');
      
      expect(attempts).toBe(3); // initial attempt + 2 retries
    });

    test('should apply exponential backoff', async () => {
      let attempts = 0;
      const timestamps: number[] = [];
      
      const operation = async () => {
        timestamps.push(Date.now());
        attempts++;
        if (attempts < 3) {
          throw new Error('Failure for backoff test');
        }
        return 'success';
      };

      await executeWithRetry(
        operation,
        { retries: 2, retryInterval: 50, retryBackoff: 2 }
      );

      // Check that delays increase: 50ms, then 100ms
      expect(timestamps.length).toBe(3);
      
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      
      // Allow for timing variance
      expect(delay1).toBeGreaterThan(40); // ~50ms
      expect(delay1).toBeLessThan(70);
      
      expect(delay2).toBeGreaterThan(90); // ~100ms  
      expect(delay2).toBeLessThan(130);
    });
  });

  describe('LLM Retry Integration', () => {
    // Only run these tests if we have OpenRouter credentials (as a test provider)
    const hasCredentials = checkEnvironmentVariables('openrouter');
    const describeConditional = hasCredentials ? describe : describe.skip;

    describeConditional('Real Provider Retry Tests', () => {
      test('should handle invalid API key with retries', async () => {
        const provider = MultiLLM.createProvider('openrouter', 'invalid-key');
        const llm = provider.createLLM('microsoft/wizardlm-2-8x22b');

        const start = Date.now();

        await expect(llm.chat('Test message', {
          retries: 2,
          retryInterval: 100,
          retryBackoff: 2
        })).rejects.toThrow(/Failed after 2 retries/);

        const elapsed = Date.now() - start;
        
        // Should take at least 300ms (100 + 200ms delays) + request times
        expect(elapsed).toBeGreaterThan(250);
      }, 10000);

      test('should handle invalid model with retries', async () => {
        const provider = MultiLLM.createProvider('openrouter', process.env.OPENROUTER_API_KEY!);
        const llm = provider.createLLM('invalid/model/name');

        await expect(llm.chat('Test message', {
          retries: 1,
          retryInterval: 50,
          retryBackoff: 2
        })).rejects.toThrow(/Failed after 1 retries/);
      }, 10000);
    });
  });

  describe('Custom Retry Settings', () => {
    test('should accept zero retries', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Always fails');
      };

      await expect(executeWithRetry(
        operation,
        { retries: 0, retryInterval: 10, retryBackoff: 2 }
      )).rejects.toThrow('Failed after 0 retries');
      
      expect(attempts).toBe(1); // Only initial attempt
    });

    test('should handle high retry counts', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 6) {
          throw new Error('Failure');
        }
        return 'success';
      };

      const result = await executeWithRetry(
        operation,
        { retries: 5, retryInterval: 1, retryBackoff: 1 }
      );
      
      expect(result).toBe('success');
      expect(attempts).toBe(6);
    });

    test('should handle fractional backoff multipliers', async () => {
      let attempts = 0;
      const timestamps: number[] = [];
      
      const operation = async () => {
        timestamps.push(Date.now());
        attempts++;
        if (attempts < 3) {
          throw new Error('Failure');
        }
        return 'success';
      };

      await executeWithRetry(
        operation,
        { retries: 2, retryInterval: 100, retryBackoff: 1.5 }
      );

      // Check that delays are: 100ms, then 150ms
      expect(timestamps.length).toBe(3);
      
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      
      expect(delay1).toBeGreaterThan(85);  // ~100ms
      expect(delay1).toBeLessThan(120);
      
      expect(delay2).toBeGreaterThan(135); // ~150ms
      expect(delay2).toBeLessThan(170);
    });
  });
});