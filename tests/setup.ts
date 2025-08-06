import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Test configuration
export const TEST_CONFIG = {
  timeout: 30000, // 30 seconds
  shortTimeout: 5000, // 5 seconds for quick tests
};

// Environment variable checks for different providers
export const checkEnvironmentVariables = (provider: string): boolean => {
  switch (provider.toLowerCase()) {
    case 'openrouter':
      return !!(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL);
    case 'openai':
      return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);
    case 'anthropic':
      return !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL);
    case 'groq':
      return !!(process.env.GROQ_API_KEY && process.env.GROQ_MODEL);
    case 'cerebras':
      return !!(process.env.CEREBRAS_API_KEY && process.env.CEREBRAS_MODEL);
    case 'ollama':
      return !!process.env.OLLAMA_MODEL;
    case 'azure':
      return !!(process.env.AZURE_API_KEY && process.env.AZURE_BASE_URL && process.env.AZURE_MODEL);
    case 'google':
      return !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_MODEL);
    case 'cohere':
      return !!(process.env.COHERE_API_KEY && process.env.COHERE_MODEL);
    case 'mistral':
      return !!(process.env.MISTRAL_API_KEY && process.env.MISTRAL_MODEL);
    case 'together':
      return !!(process.env.TOGETHER_API_KEY && process.env.TOGETHER_MODEL);
    case 'fireworks':
      return !!(process.env.FIREWORKS_API_KEY && process.env.FIREWORKS_MODEL);
    case 'perplexity':
      return !!(process.env.PERPLEXITY_API_KEY && process.env.PERPLEXITY_MODEL);
    case 'deepinfra':
      return !!(process.env.DEEPINFRA_API_KEY && process.env.DEEPINFRA_MODEL);
    case 'replicate':
      return !!(process.env.REPLICATE_API_KEY && process.env.REPLICATE_MODEL);
    case 'huggingface':
      return !!(process.env.HUGGINGFACE_API_KEY && process.env.HUGGINGFACE_MODEL);
    case 'bedrock':
      return !!(process.env.BEDROCK_API_KEY && process.env.BEDROCK_MODEL && process.env.BEDROCK_REGION);
    default:
      return false;
  }
};

// Get all available providers based on environment variables
export const getAvailableProviders = (): string[] => {
  const allProviders = ['openrouter', 'openai', 'anthropic', 'groq', 'cerebras', 'ollama', 'azure', 'google', 'cohere', 'mistral', 'together', 'fireworks', 'perplexity', 'deepinfra', 'replicate', 'huggingface', 'bedrock'];
  return allProviders.filter(provider => checkEnvironmentVariables(provider));
};

// Log provider status
export const logProviderStatus = (): void => {
  const providers = {
    'OpenRouter': { key: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL', extra: undefined },
    'OpenAI': { key: 'OPENAI_API_KEY', model: 'OPENAI_MODEL', extra: undefined },
    'Anthropic': { key: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL', extra: undefined },
    'Groq': { key: 'GROQ_API_KEY', model: 'GROQ_MODEL', extra: undefined },
    'Cerebras': { key: 'CEREBRAS_API_KEY', model: 'CEREBRAS_MODEL', extra: undefined },
    'Ollama': { key: undefined, model: 'OLLAMA_MODEL', extra: undefined },
    'Azure': { key: 'AZURE_API_KEY', model: 'AZURE_MODEL', extra: 'AZURE_BASE_URL' },
    'Google': { key: 'GOOGLE_API_KEY', model: 'GOOGLE_MODEL', extra: undefined },
    'Cohere': { key: 'COHERE_API_KEY', model: 'COHERE_MODEL', extra: undefined },
    'Mistral': { key: 'MISTRAL_API_KEY', model: 'MISTRAL_MODEL', extra: undefined },
    'Together': { key: 'TOGETHER_API_KEY', model: 'TOGETHER_MODEL', extra: undefined },
    'Fireworks': { key: 'FIREWORKS_API_KEY', model: 'FIREWORKS_MODEL', extra: undefined },
    'Perplexity': { key: 'PERPLEXITY_API_KEY', model: 'PERPLEXITY_MODEL', extra: undefined },
    'DeepInfra': { key: 'DEEPINFRA_API_KEY', model: 'DEEPINFRA_MODEL', extra: undefined },
    'Replicate': { key: 'REPLICATE_API_KEY', model: 'REPLICATE_MODEL', extra: undefined },
    'HuggingFace': { key: 'HUGGINGFACE_API_KEY', model: 'HUGGINGFACE_MODEL', extra: undefined },
    'Bedrock': { key: 'BEDROCK_API_KEY', model: 'BEDROCK_MODEL', extra: 'BEDROCK_REGION' }
  };

  console.log('\n📊 Provider Environment Status:');
  Object.entries(providers).forEach(([name, config]) => {
    const hasKey = !config.key || !!process.env[config.key];
    const hasModel = !!process.env[config.model];
    const hasExtra = !config.extra || !!process.env[config.extra];
    const available = hasKey && hasModel && hasExtra;
    
    console.log(`   ${name}: ${available ? '✅' : '❌'} ${available ? 'Available' : 'Missing credentials'}`);
  });
  
  const available = getAvailableProviders();
  console.log(`\n🎯 ${available.length} provider${available.length === 1 ? '' : 's'} available for testing: ${available.join(', ')}`);
  
  if (available.length === 0) {
    console.log('\n💡 To run tests, set up environment variables in .env file:');
    console.log('   cp .env.example .env');
    console.log('   # Edit .env with your API keys and models\n');
  }
};