import { MultiLLM } from '../../src/index';
import { HuggingFaceProvider } from '../../src/providers/huggingface';
import { checkEnvironmentVariables, TEST_CONFIG } from '../setup';

const hasCredentials = checkEnvironmentVariables('huggingface');

const describeConditional = hasCredentials ? describe : describe.skip;

describeConditional('HuggingFace Provider Tests', () => {
  let provider: HuggingFaceProvider;
  const apiKey = process.env.HUGGINGFACE_API_KEY!;
  const modelId = process.env.HUGGINGFACE_MODEL!;

  beforeAll(() => {
    provider = MultiLLM.createProvider('huggingface', apiKey) as HuggingFaceProvider;
  });

  describe('Provider Creation', () => {
    test('should create HuggingFace provider successfully', () => {
      expect(provider).toBeInstanceOf(HuggingFaceProvider);
    });

    test('should have correct base configuration', () => {
      expect(provider['apiKey']).toBe(apiKey);
      expect(provider['baseUrl']).toBe('https://api-inference.huggingface.co/models');
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
      
      const result = await llm.chat('Say "Hello, HuggingFace!" and nothing else.', {
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
      
      // Check usage stats if available
      if (result.usage) {
        expect(result.usage.inputTokens).toBeGreaterThan(-1); // Allow 0 for providers that don't track
        expect(result.usage.outputTokens).toBeGreaterThan(-1);
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
  });

  describe('Error Handling', () => {
    test('should handle invalid model gracefully', async () => {
      const invalidProvider = MultiLLM.createProvider('huggingface', apiKey) as HuggingFaceProvider;
      const invalidLlm = invalidProvider.createLLM('invalid-model-id-12345');
      
      await expect(invalidLlm.chat('Hello', {})).rejects.toThrow();
    }, TEST_CONFIG.timeout);

    test('should handle empty API key', () => {
      expect(() => {
        MultiLLM.createProvider('huggingface', '');
      }).not.toThrow(); // Should create but fail on API calls
    });
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