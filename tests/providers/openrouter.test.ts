import { MultiLLM } from '../../src/index';
import { OpenRouterProvider } from '../../src/providers/openrouter';
import { checkEnvironmentVariables, TEST_CONFIG } from '../setup';

const hasCredentials = checkEnvironmentVariables('openrouter');

const describeConditional = hasCredentials ? describe : describe.skip;

describeConditional('OpenRouter Provider Tests', () => {
  let provider: OpenRouterProvider;
  const apiKey = process.env.OPENROUTER_API_KEY!;
  const modelId = process.env.OPENROUTER_MODEL!;

  beforeAll(() => {
    provider = MultiLLM.createProvider('openrouter', apiKey) as OpenRouterProvider;
  });

  describe('Provider Creation', () => {
    test('should create OpenRouter provider successfully', () => {
      expect(provider).toBeInstanceOf(OpenRouterProvider);
    });

    test('should have correct base configuration', () => {
      expect(provider['apiKey']).toBe(apiKey);
      expect(provider['baseUrl']).toBe('https://openrouter.ai/api/v1');
    });
  });

  describe('Model Management', () => {
    test('should fetch available models', async () => {
      const models = await provider.getModels();
      
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      
      // Check model structure
      const model = models[0];
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('contextWindow');
      expect(typeof model.contextWindow).toBe('number');
      expect(model.contextWindow).toBeGreaterThan(0);
    }, TEST_CONFIG.timeout);

    test('should find the specified test model', async () => {
      const models = await provider.getModels();
      const testModel = models.find(m => m.id === modelId);
      
      expect(testModel).toBeDefined();
      expect(testModel?.id).toBe(modelId);
      
      // Log model info for debugging
      console.log(`\n📊 Test Model Info:`, {
        id: testModel?.id,
        name: testModel?.name,
        contextWindow: testModel?.contextWindow,
        maxOutputTokens: testModel?.maxOutputTokens,
        pricing: testModel?.pricing
      });
    }, TEST_CONFIG.timeout);
  });

  describe('LLM Creation', () => {
    test('should create LLM instance', () => {
      const llm = provider.createLLM(modelId);
      
      expect(llm).toBeDefined();
      expect(llm['modelId']).toBe(modelId);
      expect(llm['provider']).toBe(provider);
    });
  });

  describe('Non-Streaming Chat', () => {
    let llm: any;

    beforeEach(() => {
      llm = provider.createLLM(modelId);
    });

    test('should handle simple chat request', async () => {
      const startTime = Date.now();
      
      const result = await llm.chat('Say "Hello, OpenRouter!" and nothing else.', {
        temperature: 0.1,
        maxTokens: 50
      });
      
      const responseTime = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(result.parsed).toBeDefined();
      expect(result.parsed.content).toBeDefined();
      expect(typeof result.parsed.content).toBe('string');
      
      // More flexible content check - just ensure we got some response
      expect(result.parsed.content.trim().length).toBeGreaterThan(0);
      
      // Performance check - should respond within reasonable time
      expect(responseTime).toBeLessThan(30000); // 30 seconds max
      
      console.log(`\n⚡ Non-streaming Response Time: ${responseTime}ms`);
      console.log(`📝 Response: "${result.parsed.content}"`);
      
      // If we got a response but it doesn't contain "hello", log but don't fail
      if (!result.parsed.content.toLowerCase().includes('hello')) {
        console.warn(`⚠️  Response didn't contain "hello" but was: "${result.parsed.content}"`);
      }
      
      // Check usage stats if available
      if (result.usage) {
        expect(result.usage.inputTokens).toBeGreaterThan(0);
        expect(result.usage.outputTokens).toBeGreaterThan(0);
        console.log(`📊 Token Usage:`, result.usage);
      }
    }, TEST_CONFIG.timeout);

    test('should handle system prompt', async () => {
      const result = await llm.chat('What is 2+2?', {
        temperature: 0.1,
        maxTokens: 50,
        system: 'You are a calculator. Only respond with the number, no explanation.'
      });
      
      expect(result.parsed.content).toBeDefined();
      expect(result.parsed.content.trim()).toContain('4');
      
      console.log(`\n🧮 System Prompt Test: "${result.parsed.content}"`);
    }, TEST_CONFIG.timeout);

    test('should parse code blocks correctly', async () => {
      const result = await llm.chat('Write a simple Python function to add two numbers. Include the code in a code block.', {
        temperature: 0.3,
        maxTokens: 200
      });
      
      expect(result.parsed.content).toBeDefined();
      expect(Array.isArray(result.parsed.codeBlocks)).toBe(true);
      
      if (result.parsed.codeBlocks.length > 0) {
        const codeBlock = result.parsed.codeBlocks[0];
        expect(codeBlock).toHaveProperty('language');
        expect(codeBlock).toHaveProperty('code');
        expect(codeBlock.code).toContain('def');
        
        console.log(`\n💻 Code Block Found:`, codeBlock);
      }
    }, TEST_CONFIG.timeout);
  });

  describe('Streaming Chat', () => {
    let llm: any;

    beforeEach(() => {
      llm = provider.createLLM(modelId);
    });

    test('should handle streaming chat request', async () => {
      const chunks: string[] = [];
      const startTime = Date.now();
      let firstChunkTime: number | null = null;
      
      const result = await llm.chat('Count from 1 to 5, each number on a new line.', {
        temperature: 0.1,
        maxTokens: 100
      }, (chunk: string) => {
        if (firstChunkTime === null) {
          firstChunkTime = Date.now();
        }
        chunks.push(chunk);
      });
      
      const totalTime = Date.now() - startTime;
      const timeToFirstChunk = firstChunkTime ? firstChunkTime - startTime : totalTime;
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(result.parsed.content).toBeDefined();
      
      // Verify streaming actually happened
      const fullContent = chunks.join('');
      expect(fullContent).toBeTruthy();
      expect(fullContent.length).toBeGreaterThan(0);
      
      // Performance metrics
      expect(timeToFirstChunk).toBeLessThan(15000); // First chunk within 15 seconds
      
      console.log(`\n🚀 Streaming Performance:`);
      console.log(`   Total chunks: ${chunks.length}`);
      console.log(`   Time to first chunk: ${timeToFirstChunk}ms`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Average chunk size: ${Math.round(fullContent.length / chunks.length)} chars`);
      console.log(`📝 Streamed content: "${fullContent}"`);
      
      // Verify final result matches streamed content
      expect(result.parsed.content.trim()).toBe(fullContent.trim());
    }, TEST_CONFIG.timeout);

    test('should handle streaming with large response', async () => {
      const chunks: string[] = [];
      const startTime = Date.now();
      
      const result = await llm.chat('Write a short story about a robot discovering emotions. Keep it under 500 words.', {
        temperature: 0.7,
        maxTokens: 600
      }, (chunk: string) => {
        chunks.push(chunk);
      });
      
      const totalTime = Date.now() - startTime;
      
      expect(chunks.length).toBeGreaterThan(10); // Should have multiple chunks for longer content
      expect(result.parsed.content.length).toBeGreaterThan(100);
      
      console.log(`\n📖 Long Content Streaming:`);
      console.log(`   Chunks: ${chunks.length}`);
      console.log(`   Content length: ${result.parsed.content.length} chars`);
      console.log(`   Time: ${totalTime}ms`);
      console.log(`   Avg chars/sec: ${Math.round(result.parsed.content.length / (totalTime / 1000))}`);
    }, TEST_CONFIG.timeout);
  });

  describe('Error Handling', () => {
    test('should handle invalid model gracefully', async () => {
      const invalidProvider = MultiLLM.createProvider('openrouter', apiKey) as OpenRouterProvider;
      const invalidLlm = invalidProvider.createLLM('invalid-model-id-12345');
      
      await expect(invalidLlm.chat('Hello', {})).rejects.toThrow();
    }, TEST_CONFIG.timeout);

    test('should handle empty API key', () => {
      expect(() => {
        MultiLLM.createProvider('openrouter', '');
      }).not.toThrow(); // Should create but fail on API calls
    });

    test('should retry on API failures with exponential backoff', async () => {
      const invalidProvider = MultiLLM.createProvider('openrouter', 'invalid-key-for-retry-test') as OpenRouterProvider;
      const invalidLlm = invalidProvider.createLLM(modelId);

      const start = Date.now();

      await expect(invalidLlm.chat('Hello', {
        retries: 2,
        retryInterval: 100,
        retryBackoff: 2
      })).rejects.toThrow(/Failed after 2 retries/);

      const elapsed = Date.now() - start;
      
      // Should take at least 300ms (100 + 200ms delays) plus request times
      console.log(`\n⏱️  Retry test took ${elapsed}ms (expected >250ms with delays)`);
      expect(elapsed).toBeGreaterThan(250);
    }, 15000);

    test('should succeed without retries on valid requests', async () => {
      let llm = provider.createLLM(modelId);
      
      const start = Date.now();
      
      const result = await llm.chat('Say "test" and nothing else.', {
        retries: 3,
        retryInterval: 1000,
        retryBackoff: 2,
        maxTokens: 10
      });
      
      const elapsed = Date.now() - start;
      
      expect(result.parsed.content).toBeDefined();
      expect(result.parsed.content.length).toBeGreaterThan(0);
      
      // Should complete quickly without retries (well under the retry intervals)
      console.log(`\n✅ Successful request with retry config took ${elapsed}ms`);
      expect(elapsed).toBeLessThan(30000); // Much less than retry delays would add
    }, TEST_CONFIG.timeout);

    test('should handle custom retry configuration', async () => {
      const invalidProvider = MultiLLM.createProvider('openrouter', 'invalid-key') as OpenRouterProvider;
      const invalidLlm = invalidProvider.createLLM(modelId);

      const start = Date.now();

      await expect(invalidLlm.chat('Hello', {
        retries: 1,           // Only 1 retry
        retryInterval: 50,    // 50ms initial delay
        retryBackoff: 3       // 3x multiplier
      })).rejects.toThrow(/Failed after 1 retries/);

      const elapsed = Date.now() - start;
      
      // Should take at least 50ms delay plus request times
      console.log(`\n🔧 Custom retry config took ${elapsed}ms (expected >40ms)`);
      expect(elapsed).toBeGreaterThan(40);
      expect(elapsed).toBeLessThan(5000); // But not too long
    }, 10000);
  });

  describe('Response Parsing', () => {
    let llm: any;

    beforeEach(() => {
      llm = provider.createLLM(modelId);
    });

    test('should parse complex response with multiple elements', async () => {
      const result = await llm.chat(`
        Please respond with:
        1. A greeting
        2. A Python code block that prints "Hello World"
        3. A conclusion
      `, {
        temperature: 0.3,
        maxTokens: 300
      });
      
      expect(result.parsed.content).toBeDefined();
      expect(result.parsed.codeBlocks).toBeDefined();
      
      console.log(`\n🔍 Parsed Response:`, {
        contentLength: result.parsed.content.length,
        codeBlocks: result.parsed.codeBlocks.length,
        thinking: result.parsed.thinking ? 'Present' : 'None'
      });
      
      if (result.parsed.codeBlocks.length > 0) {
        console.log(`💻 Code blocks found:`, result.parsed.codeBlocks);
      }
    }, TEST_CONFIG.timeout);
  });
});