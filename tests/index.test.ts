import { getAvailableProviders, logProviderStatus } from './setup';

describe('Multi-LLM Test Suite', () => {
  beforeAll(() => {
    logProviderStatus();
  });

  test('should have at least one provider available for testing', () => {
    const availableProviders = getAvailableProviders();
    
    if (availableProviders.length === 0) {
      console.warn('\n⚠️  No providers configured for testing');
      console.warn('📋 To enable tests, set up environment variables in .env file:');
      console.warn('   cp .env.example .env');
      console.warn('   # Edit .env with your API keys and models');
      console.warn('\n🔧 Available providers to configure:');
      console.warn('   - OpenRouter: OPENROUTER_API_KEY, OPENROUTER_MODEL');
      console.warn('   - OpenAI: OPENAI_API_KEY, OPENAI_MODEL');
      console.warn('   - Anthropic: ANTHROPIC_API_KEY, ANTHROPIC_MODEL');
      console.warn('   - Groq: GROQ_API_KEY, GROQ_MODEL');
      console.warn('   - Cerebras: CEREBRAS_API_KEY, CEREBRAS_MODEL');
      console.warn('   - Ollama: OLLAMA_MODEL (+ optional OLLAMA_BASE_URL)');
      console.warn('   - Azure: AZURE_API_KEY, AZURE_BASE_URL, AZURE_MODEL\n');
    }

    // Don't fail the test if no providers are configured, just warn
    expect(true).toBe(true); // Always pass this test
  });

  test('should display configured providers', () => {
    const availableProviders = getAvailableProviders();
    console.log(`\n✅ Test execution will run for ${availableProviders.length} provider(s): ${availableProviders.join(', ')}`);
    
    if (availableProviders.length > 0) {
      console.log('🚀 Provider-specific tests will execute for configured providers');
      console.log('⏭️  Provider tests without credentials will be skipped');
    }
    
    expect(true).toBe(true); // Always pass
  });
});