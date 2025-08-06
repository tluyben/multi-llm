import { MultiLLM } from '../../src/index';
import { CerebrasProvider } from '../../src/providers/cerebras';
import { checkEnvironmentVariables, TEST_CONFIG } from '../setup';

const hasCredentials = checkEnvironmentVariables('cerebras');

const describeConditional = hasCredentials ? describe : describe.skip;

describeConditional('Cerebras Provider Tests', () => {
  let provider: CerebrasProvider;
  const apiKey = process.env.CEREBRAS_API_KEY!;
  const modelId = process.env.CEREBRAS_MODEL!;

  beforeAll(() => {
    provider = MultiLLM.createProvider('cerebras', apiKey) as CerebrasProvider;
  });

  describe('Provider Creation', () => {
    test('should create Cerebras provider successfully', () => {
      expect(provider).toBeInstanceOf(CerebrasProvider);
    });
  });

  describe('Non-Streaming Chat', () => {
    let llm: any;

    beforeEach(() => {
      llm = provider.createLLM(modelId);
    });

    test('should handle simple chat request', async () => {
      const result = await llm.chat('Say "Hello, Cerebras!" and nothing else.', {
        temperature: 0.1,
        maxTokens: 50
      });
      
      expect(result.parsed.content).toBeDefined();
      expect(result.parsed.content.toLowerCase()).toContain('hello');
      console.log(`\n⚡ Cerebras Response: "${result.parsed.content}"`);
    }, TEST_CONFIG.timeout);
  });
});