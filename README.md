# Multi-LLM 🤖

A unified TypeScript/JavaScript package to use LLMs across **ALL** platforms with support for streaming, MCP tools, and intelligent response parsing.

## Features

- **🌐 Universal Provider Support**: **17 Major Providers** including OpenAI, Anthropic, Google Gemini, Cohere, Mistral AI, Together AI, Fireworks AI, OpenRouter, Groq, Cerebras, Ollama, Azure OpenAI, Perplexity, DeepInfra, Replicate, HuggingFace, AWS Bedrock
- **⚡ Streaming & Non-Streaming**: Real-time streaming or batch processing
- **🧠 Smart Response Parsing**: Automatic extraction of code blocks, thinking sections, and structured content  
- **🔧 MCP Integration**: Add Model Context Protocol tools to enhance capabilities
- **📘 TypeScript Support**: Full type definitions and IntelliSense
- **🎯 Unified API**: Same interface across all 17 providers
- **🧪 Smart Testing**: Conditional tests run only for configured providers

## Installation

```bash
npm install multi-llm
```

## Quick Start

```typescript
import { MultiLLM } from 'multi-llm';

// Create a provider
const provider = MultiLLM.createProvider('openai', 'your-api-key');

// Get available models
const models = await provider.getModels();
console.log(models);

// Create LLM instance
const llm = provider.createLLM('gpt-4o-mini');

// Non-streaming chat
const result = await llm.chat('What is the capital of France?', {
  temperature: 0.7,
  maxTokens: 100,
  system: 'You are a helpful geography assistant'
});

console.log(result.parsed.content);

// Streaming chat
const streamResult = await llm.chat('Tell me a story', {
  temperature: 1.0
}, (chunk) => {
  process.stdout.write(chunk); // Real-time streaming
});
```

## Supported Providers

### OpenAI
```typescript
const provider = MultiLLM.createProvider('openai', 'sk-...');
const llm = provider.createLLM('gpt-4o-mini');
```

### Anthropic
```typescript
const provider = MultiLLM.createProvider('anthropic', 'sk-ant-...');
const llm = provider.createLLM('claude-3-5-sonnet-20241022');
```

### OpenRouter
```typescript
const provider = MultiLLM.createProvider('openrouter', 'sk-or-...');
const llm = provider.createLLM('microsoft/wizardlm-2-8x22b');
```

### Groq
```typescript
const provider = MultiLLM.createProvider('groq', 'gsk_...');
const llm = provider.createLLM('llama3-70b-8192');
```

### Cerebras
```typescript
const provider = MultiLLM.createProvider('cerebras', 'csk-...');
const llm = provider.createLLM('llama3.1-70b');
```

### Ollama (Local)
```typescript
const provider = MultiLLM.createProvider('ollama', '', 'http://localhost:11434');
const llm = provider.createLLM('llama3.2');
```

### Azure OpenAI
```typescript
const provider = MultiLLM.createProvider('azure', 'your-api-key', 'https://your-resource.openai.azure.com');
const llm = provider.createLLM('your-deployment-name');
```

### Google Gemini
```typescript
const provider = MultiLLM.createProvider('google', 'your-api-key');
const llm = provider.createLLM('gemini-2.5-pro');
```

### Cohere
```typescript
const provider = MultiLLM.createProvider('cohere', 'your-api-key');
const llm = provider.createLLM('command-r-plus');
```

### Mistral AI
```typescript
const provider = MultiLLM.createProvider('mistral', 'your-api-key');
const llm = provider.createLLM('mistral-large-latest');
```

### Together AI
```typescript
const provider = MultiLLM.createProvider('together', 'your-api-key');
const llm = provider.createLLM('meta-llama/Llama-3.2-3B-Instruct-Turbo');
```

### Fireworks AI
```typescript
const provider = MultiLLM.createProvider('fireworks', 'your-api-key');
const llm = provider.createLLM('accounts/fireworks/models/llama-v3p1-70b-instruct');
```

### Perplexity
```typescript
const provider = MultiLLM.createProvider('perplexity', 'your-api-key');
const llm = provider.createLLM('llama-3.1-sonar-large-128k-online');
```

### DeepInfra
```typescript
const provider = MultiLLM.createProvider('deepinfra', 'your-api-key');
const llm = provider.createLLM('meta-llama/Meta-Llama-3.1-8B-Instruct');
```

### Replicate
```typescript
const provider = MultiLLM.createProvider('replicate', 'your-api-key');
const llm = provider.createLLM('meta/llama-2-70b-chat');
```

### Hugging Face
```typescript
const provider = MultiLLM.createProvider('huggingface', 'your-api-key');
const llm = provider.createLLM('mistralai/Mixtral-8x7B-Instruct-v0.1');
```

### Amazon Bedrock
```typescript
const provider = MultiLLM.createProvider('bedrock', 'accessKeyId:secretAccessKey');
const llm = provider.createLLM('anthropic.claude-3-5-sonnet-20241022-v2:0');
```

## Response Structure

Every chat response includes:

```typescript
interface ChatResult {
  raw: any;                    // Raw provider response
  parsed: {
    content: string;           // Clean text content
    codeBlocks: Array<{        // Extracted code blocks
      language: string;
      code: string;
    }>;
    thinking?: string;         // Extracted thinking/reasoning
    toolCalls?: Array<{        // MCP tool calls (if available)
      id: string;
      function: string;
      args: any;
      execute: () => Promise<any>;
    }>;
  };
  usage?: {                    // Token usage stats
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}
```

## MCP (Model Context Protocol) Integration

Add tools to enhance your LLM's capabilities:

```typescript
const llm = provider.createLLM('gpt-4o-mini');

// Add MCP server
llm.addMCP('python3 -m my_mcp_server');

// Chat with tool access
const result = await llm.chat('Calculate the fibonacci sequence', {});

// Execute tool calls if present
if (result.parsed.toolCalls?.length > 0) {
  for (const toolCall of result.parsed.toolCalls) {
    const toolResult = await toolCall.execute();
    console.log(`Tool ${toolCall.function} result:`, toolResult);
  }
}
```

## Testing

The package includes comprehensive tests for each provider. Tests are only run for providers with valid environment variables.

### Environment Setup

The test system **automatically detects available providers** based on environment variables. Only providers with valid credentials will run tests.

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your API keys (add only the providers you want to test)
```

**Provider Environment Variables** (add only what you have):

```env
# OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=microsoft/wizardlm-2-8x22b

# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# Anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Google Gemini
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MODEL=gemini-2.5-pro

# Cohere
COHERE_API_KEY=your_cohere_api_key
COHERE_MODEL=command-r-plus

# Mistral AI
MISTRAL_API_KEY=your_mistral_api_key
MISTRAL_MODEL=mistral-large-latest

# Together AI
TOGETHER_API_KEY=your_together_api_key
TOGETHER_MODEL=meta-llama/Llama-3.2-3B-Instruct-Turbo

# Fireworks AI
FIREWORKS_API_KEY=your_fireworks_api_key
FIREWORKS_MODEL=accounts/fireworks/models/llama-v3p1-70b-instruct

# Groq
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama3-70b-8192

# Cerebras
CEREBRAS_API_KEY=your_cerebras_api_key
CEREBRAS_MODEL=llama3.1-70b

# Ollama (local)
OLLAMA_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434

# Azure OpenAI
AZURE_API_KEY=your_azure_api_key
AZURE_BASE_URL=https://your-resource.openai.azure.com
AZURE_MODEL=your-deployment-name

# Perplexity
PERPLEXITY_API_KEY=your_perplexity_api_key
PERPLEXITY_MODEL=llama-3.1-sonar-large-128k-online

# DeepInfra
DEEPINFRA_API_KEY=your_deepinfra_api_key
DEEPINFRA_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct

# Replicate
REPLICATE_API_KEY=your_replicate_api_key
REPLICATE_MODEL=meta/llama-2-70b-chat

# Hugging Face
HUGGINGFACE_API_KEY=your_huggingface_api_key
HUGGINGFACE_MODEL=mistralai/Mixtral-8x7B-Instruct-v0.1

# AWS Bedrock
BEDROCK_API_KEY=accessKeyId:secretAccessKey
BEDROCK_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_REGION=us-east-1
```

### Running Tests

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run all tests
# ✅ Providers with valid credentials will run tests
# ⏭️  Providers without credentials will be skipped
npm test

# Run tests for specific provider
npm test -- --testPathPattern=openrouter

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

**Example Output:**
```
📊 Provider Environment Status:
   OpenRouter: ✅ Available
   OpenAI: ❌ Missing credentials
   Anthropic: ✅ Available
   Google: ✅ Available
   Cohere: ❌ Missing credentials
   Mistral: ❌ Missing credentials
   Together: ❌ Missing credentials
   Fireworks: ❌ Missing credentials
   Groq: ❌ Missing credentials
   Cerebras: ❌ Missing credentials
   Ollama: ❌ Missing credentials
   Azure: ❌ Missing credentials
   Perplexity: ❌ Missing credentials
   DeepInfra: ❌ Missing credentials
   Replicate: ❌ Missing credentials
   HuggingFace: ❌ Missing credentials
   Bedrock: ❌ Missing credentials

🎯 3 providers available for testing: openrouter, anthropic, google

✅ Test execution will run for 3 provider(s): openrouter, anthropic, google
🚀 Provider-specific tests will execute for configured providers
⏭️  Provider tests without credentials will be skipped
```

### Test Categories

Each provider test suite includes:

- **Provider Creation**: Basic instantiation and configuration
- **Model Management**: Fetching available models and metadata
- **Non-Streaming Chat**: Standard request/response with performance metrics
- **Streaming Chat**: Real-time streaming with chunk analysis
- **Error Handling**: Invalid requests and edge cases
- **Response Parsing**: Code blocks, thinking extraction, and structured content

### Performance Metrics

Tests automatically measure and report:
- Response time for non-streaming requests
- Time to first chunk for streaming requests  
- Total streaming time
- Token usage statistics (when available)
- Chunk count and average size for streaming

## API Reference

### MultiLLM

```typescript
class MultiLLM {
  static createProvider(type: ProviderType, apiKey: string, baseUrl?: string): Provider
}
```

### Provider

```typescript
abstract class Provider {
  abstract getModels(): Promise<ModelInfo[]>
  abstract createLLM(modelId: string): LLM
}
```

### LLM

```typescript
class LLM {
  addMCP(startupCommand: string): void
  chat(content: string, options: ChatOptions, streamCallback?: StreamCallback): Promise<ChatResult>
  dispose(): void
}
```

### ChatOptions

```typescript
interface ChatOptions {
  temperature?: number;      // 0.0 to 2.0
  maxTokens?: number;        // Maximum output tokens
  topP?: number;            // Nucleus sampling parameter
  topK?: number;            // Top-K sampling parameter  
  system?: string;          // System message
  stream?: boolean;         // Automatically set based on callback presence
  [key: string]: any;       // Provider-specific options
}
```

## Examples

See `example.js` for comprehensive usage examples across all providers.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Add tests for your changes
4. Run the test suite (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Changelog

### v1.0.0
- Initial release with support for **17 providers**:
  - **Core Providers**: OpenAI, Anthropic, Google Gemini, OpenRouter
  - **Performance Providers**: Groq, Cerebras, Together AI, Fireworks AI
  - **Specialized Providers**: Cohere, Mistral AI, Perplexity, DeepInfra
  - **Local/Custom**: Ollama, Azure OpenAI
  - **Cloud Platforms**: Replicate, Hugging Face, AWS Bedrock
- **Streaming and non-streaming** support across all providers
- **Smart response parsing** with code block and thinking extraction
- **MCP integration** framework for enhanced capabilities
- **Conditional testing** system that adapts to available credentials
- **Comprehensive test suite** with performance metrics
- **Full TypeScript** definitions and IntelliSense support