import { MultiLLM } from '../../src/index';
import { AzureProvider } from '../../src/providers/azure';
import { checkEnvironmentVariables, TEST_CONFIG } from '../setup';

const hasCredentials = checkEnvironmentVariables('azure');

const describeConditional = hasCredentials ? describe : describe.skip;

describeConditional('Azure OpenAI Provider Tests', () => {
  let provider: AzureProvider;
  const apiKey = process.env.AZURE_API_KEY!;
  const baseUrl = process.env.AZURE_BASE_URL!;
  const modelId = process.env.AZURE_MODEL!;

  beforeAll(() => {
    provider = MultiLLM.createProvider('azure', apiKey, baseUrl) as AzureProvider;
  });

  describe('Provider Creation', () => {
    test('should create Azure provider successfully', () => {
      expect(provider).toBeInstanceOf(AzureProvider);
    });
  });

  describe('Non-Streaming Chat', () => {
    let llm: any;

    beforeEach(() => {
      llm = provider.createLLM(modelId);
    });

    test('should handle simple chat request', async () => {
      const result = await llm.chat('Say "Hello, Azure!" and nothing else.', {
        temperature: 0.1,
        maxTokens: 50
      });
      
      expect(result.parsed.content).toBeDefined();
      expect(result.parsed.content.toLowerCase()).toContain('hello');
      console.log(`\n⚡ Azure Response: "${result.parsed.content}"`);
    }, TEST_CONFIG.timeout);
  });
});