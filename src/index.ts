import { ProviderType } from './types';
import { Provider } from './provider';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { OpenRouterProvider } from './providers/openrouter';
import { GroqProvider } from './providers/groq';
import { CerebrasProvider } from './providers/cerebras';
import { OllamaProvider } from './providers/ollama';
import { AzureProvider } from './providers/azure';

export class MultiLLM {
  static createProvider(type: ProviderType, apiKey: string, baseUrl?: string): Provider {
    switch (type) {
      case 'openai':
        return new OpenAIProvider(apiKey, baseUrl);
      case 'anthropic':
        return new AnthropicProvider(apiKey, baseUrl);
      case 'openrouter':
        return new OpenRouterProvider(apiKey, baseUrl);
      case 'groq':
        return new GroqProvider(apiKey, baseUrl);
      case 'cerebras':
        return new CerebrasProvider(apiKey, baseUrl);
      case 'ollama':
        return new OllamaProvider(apiKey, baseUrl);
      case 'azure':
        return new AzureProvider(apiKey, baseUrl);
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }
}

export * from './types';
export * from './provider';
export * from './llm';
export { MultiLLM as default };