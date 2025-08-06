export interface ModelInfo {
  id: string;
  name: string;
  pricing?: {
    input: number;
    output: number;
    currency: string;
  };
  contextWindow: number;
  maxOutputTokens?: number;
  description?: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  system?: string;
  stream?: boolean;
  [key: string]: any;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ParsedResult {
  content: string;
  codeBlocks: Array<{ language: string; code: string }>;
  thinking?: string;
  toolCalls?: Array<{
    id: string;
    function: string;
    args: any;
    execute: () => Promise<any>;
  }>;
}

export interface ChatResult {
  raw: any;
  parsed: ParsedResult;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export type StreamCallback = (chunk: string) => void;

export type ProviderType = 'openai' | 'anthropic' | 'openrouter' | 'groq' | 'cerebras' | 'ollama' | 'azure' | 'google' | 'cohere' | 'mistral' | 'together' | 'fireworks' | 'perplexity' | 'deepinfra' | 'replicate' | 'huggingface' | 'bedrock';