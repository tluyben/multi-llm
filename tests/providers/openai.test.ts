import { MultiLLM } from '../../src/index';
import { OpenAIProvider } from '../../src/providers/openai';
import { checkEnvironmentVariables, TEST_CONFIG } from '../setup';

const hasCredentials = checkEnvironmentVariables('openai');

const describeConditional = hasCredentials ? describe : describe.skip;

describeConditional('OpenAI Provider Tests', () => {
  let provider: OpenAIProvider;
  const apiKey = process.env.OPENAI_API_KEY!;
  const modelId = process.env.OPENAI_MODEL!;

  beforeAll(() => {
    provider = MultiLLM.createProvider('openai', apiKey) as OpenAIProvider;
  });

  describe('Provider Creation', () => {
    test('should create OpenAI provider successfully', () => {
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    test('should have correct base configuration', () => {
      expect(provider['apiKey']).toBe(apiKey);
      expect(provider['baseUrl']).toBe('https://api.openai.com/v1');
    });
  });

  describe('Model Management', () => {
    test('should fetch available models', async () => {
      const models = await provider.getModels();
      
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      
      const model = models[0];
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('contextWindow');
      expect(typeof model.contextWindow).toBe('number');
    }, TEST_CONFIG.timeout);
  });

  describe('Non-Streaming Chat', () => {
    let llm: any;

    beforeEach(() => {
      llm = provider.createLLM(modelId);
    });

    test('should handle simple chat request', async () => {
      const startTime = Date.now();
      
      const result = await llm.chat('Say "Hello, OpenAI!" and nothing else.', {
        temperature: 0.1,
        maxTokens: 50
      });
      
      const responseTime = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(result.parsed.content).toBeDefined();
      expect(result.parsed.content.toLowerCase()).toContain('hello');
      expect(responseTime).toBeLessThan(30000);
      
      console.log(`\n⚡ OpenAI Response Time: ${responseTime}ms`);
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
      
      const result = await llm.chat('Count from 1 to 3, each number on a new line.', {
        temperature: 0.1,
        maxTokens: 100
      }, (chunk: string) => {
        chunks.push(chunk);
      });
      
      const totalTime = Date.now() - startTime;
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(result.parsed.content).toBeDefined();
      
      console.log(`\n🚀 OpenAI Streaming: ${chunks.length} chunks in ${totalTime}ms`);
    }, TEST_CONFIG.timeout);
  });
});