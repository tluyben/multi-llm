import { MultiLLM } from '../../src/index';
import { AnthropicProvider } from '../../src/providers/anthropic';
import { checkEnvironmentVariables, TEST_CONFIG } from '../setup';

const hasCredentials = checkEnvironmentVariables('anthropic');

const describeConditional = hasCredentials ? describe : describe.skip;

describeConditional('Anthropic Provider Tests', () => {
  let provider: AnthropicProvider;
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const modelId = process.env.ANTHROPIC_MODEL!;

  beforeAll(() => {
    provider = MultiLLM.createProvider('anthropic', apiKey) as AnthropicProvider;
  });

  describe('Provider Creation', () => {
    test('should create Anthropic provider successfully', () => {
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    test('should have correct base configuration', () => {
      expect(provider['apiKey']).toBe(apiKey);
      expect(provider['baseUrl']).toBe('https://api.anthropic.com/v1');
    });
  });

  describe('Model Management', () => {
    test('should return known Claude models', async () => {
      const models = await provider.getModels();
      
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      
      const testModel = models.find(m => m.id === modelId);
      expect(testModel).toBeDefined();
      
      console.log(`\n📊 Anthropic Test Model:`, testModel);
    }, TEST_CONFIG.timeout);
  });

  describe('Non-Streaming Chat', () => {
    let llm: any;

    beforeEach(() => {
      llm = provider.createLLM(modelId);
    });

    test('should handle simple chat request', async () => {
      const startTime = Date.now();
      
      const result = await llm.chat('Say "Hello, Claude!" and nothing else.', {
        temperature: 0.1,
        maxTokens: 50
      });
      
      const responseTime = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(result.parsed.content).toBeDefined();
      expect(result.parsed.content.toLowerCase()).toContain('hello');
      expect(responseTime).toBeLessThan(30000);
      
      console.log(`\n⚡ Anthropic Response Time: ${responseTime}ms`);
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
      
      console.log(`\n🚀 Anthropic Streaming: ${chunks.length} chunks in ${totalTime}ms`);
    }, TEST_CONFIG.timeout);
  });
});