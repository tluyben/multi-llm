import { MultiLLM } from '../../src/index';
import { GroqProvider } from '../../src/providers/groq';
import { checkEnvironmentVariables, TEST_CONFIG } from '../setup';

const hasCredentials = checkEnvironmentVariables('groq');

const describeConditional = hasCredentials ? describe : describe.skip;

describeConditional('Groq Provider Tests', () => {
  let provider: GroqProvider;
  const apiKey = process.env.GROQ_API_KEY!;
  const modelId = process.env.GROQ_MODEL!;

  beforeAll(() => {
    provider = MultiLLM.createProvider('groq', apiKey) as GroqProvider;
  });

  describe('Provider Creation', () => {
    test('should create Groq provider successfully', () => {
      expect(provider).toBeInstanceOf(GroqProvider);
    });
  });

  describe('Non-Streaming Chat', () => {
    let llm: any;

    beforeEach(() => {
      llm = provider.createLLM(modelId);
    });

    test('should handle simple chat request', async () => {
      const result = await llm.chat('Say "Hello, Groq!" and nothing else.', {
        temperature: 0.1,
        maxTokens: 50
      });
      
      expect(result.parsed.content).toBeDefined();
      expect(result.parsed.content.toLowerCase()).toContain('hello');
      console.log(`\n⚡ Groq Response: "${result.parsed.content}"`);
    }, TEST_CONFIG.timeout);
  });
});