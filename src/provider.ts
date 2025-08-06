import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from './types';
import { LLM } from './llm';

export abstract class Provider {
  protected apiKey: string;
  protected baseUrl?: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  abstract getModels(): Promise<ModelInfo[]>;
  abstract createLLM(modelId: string): LLM;
  abstract chat(
    modelId: string,
    messages: ChatMessage[],
    options: ChatOptions,
    streamCallback?: StreamCallback
  ): Promise<ChatResult>;
}