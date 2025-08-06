import { ProviderType } from './types';
import { Provider } from './provider';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { OpenRouterProvider } from './providers/openrouter';
import { GroqProvider } from './providers/groq';
import { CerebrasProvider } from './providers/cerebras';
import { OllamaProvider } from './providers/ollama';
import { AzureProvider } from './providers/azure';
import { GoogleProvider } from './providers/google';
import { CohereProvider } from './providers/cohere';
import { MistralProvider } from './providers/mistral';
import { TogetherProvider } from './providers/together';
import { FireworksProvider } from './providers/fireworks';
import { PerplexityProvider } from './providers/perplexity';
import { DeepInfraProvider } from './providers/deepinfra';
import { ReplicateProvider } from './providers/replicate';
import { HuggingFaceProvider } from './providers/huggingface';
import { BedrockProvider } from './providers/bedrock';

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
      case 'google':
        return new GoogleProvider(apiKey, baseUrl);
      case 'cohere':
        return new CohereProvider(apiKey, baseUrl);
      case 'mistral':
        return new MistralProvider(apiKey, baseUrl);
      case 'together':
        return new TogetherProvider(apiKey, baseUrl);
      case 'fireworks':
        return new FireworksProvider(apiKey, baseUrl);
      case 'perplexity':
        return new PerplexityProvider(apiKey, baseUrl);
      case 'deepinfra':
        return new DeepInfraProvider(apiKey, baseUrl);
      case 'replicate':
        return new ReplicateProvider(apiKey, baseUrl);
      case 'huggingface':
        return new HuggingFaceProvider(apiKey, baseUrl);
      case 'bedrock':
        return new BedrockProvider(apiKey, baseUrl);
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }
}

export * from './types';
export * from './provider';
export * from './llm';
export { MultiLLM as default };