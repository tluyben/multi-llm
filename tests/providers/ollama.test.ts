import { MultiLLM } from '../../src/index';
import { OllamaProvider } from '../../src/providers/ollama';
import { checkEnvironmentVariables, TEST_CONFIG } from '../setup';

const hasCredentials = checkEnvironmentVariables('ollama');

const describeConditional = hasCredentials ? describe : describe.skip;

describeConditional('Ollama Provider Tests', () => {
  let provider: OllamaProvider;
  const modelId = process.env.OLLAMA_MODEL!;
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  beforeAll(() => {
    provider = MultiLLM.createProvider('ollama', '', baseUrl) as OllamaProvider;
  });

  describe('Provider Creation', () => {
    test('should create Ollama provider successfully', () => {
      expect(provider).toBeInstanceOf(OllamaProvider);
    });
  });

  describe('Model Management', () => {
    test('should fetch available local models', async () => {
      const models = await provider.getModels();
      
      expect(Array.isArray(models)).toBe(true);
      
      if (models.length > 0) {
        console.log(`\n📊 Ollama Models: ${models.map(m => m.id).join(', ')}`);
      }
    }, TEST_CONFIG.timeout);
  });

  describe('Non-Streaming Chat', () => {
    let llm: any;

    beforeEach(() => {
      llm = provider.createLLM(modelId);
    });

    test('should handle simple chat request', async () => {
      const result = await llm.chat('Say "Hello, Ollama!" and nothing else.', {
        temperature: 0.1
      });
      
      expect(result.parsed.content).toBeDefined();
      expect(result.parsed.content.toLowerCase()).toContain('hello');
      console.log(`\n⚡ Ollama Response: "${result.parsed.content}"`);
    }, TEST_CONFIG.timeout);
  });
});