import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class PerplexityProvider extends Provider {
  protected baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    super(apiKey, baseUrl);
    this.baseUrl = baseUrl || 'https://api.perplexity.ai';
  }

  async getModels(): Promise<ModelInfo[]> {
    // Perplexity doesn't have a public models endpoint, return known models
    return [
      {
        id: 'llama-3.1-sonar-large-128k-online',
        name: 'Llama 3.1 Sonar Large 128K Online',
        contextWindow: 127072,
        maxOutputTokens: 4096,
        description: 'Search-enabled Llama 3.1 70B with real-time information',
        pricing: { input: 1.0, output: 1.0, currency: 'USD' }
      },
      {
        id: 'llama-3.1-sonar-small-128k-online',
        name: 'Llama 3.1 Sonar Small 128K Online',
        contextWindow: 127072,
        maxOutputTokens: 4096,
        description: 'Search-enabled Llama 3.1 8B with real-time information',
        pricing: { input: 0.2, output: 0.2, currency: 'USD' }
      },
      {
        id: 'llama-3.1-sonar-large-128k-chat',
        name: 'Llama 3.1 Sonar Large 128K Chat',
        contextWindow: 131072,
        maxOutputTokens: 4096,
        description: 'Llama 3.1 70B for general chat without search',
        pricing: { input: 1.0, output: 1.0, currency: 'USD' }
      },
      {
        id: 'llama-3.1-sonar-small-128k-chat',
        name: 'Llama 3.1 Sonar Small 128K Chat',
        contextWindow: 131072,
        maxOutputTokens: 4096,
        description: 'Llama 3.1 8B for general chat without search',
        pricing: { input: 0.2, output: 0.2, currency: 'USD' }
      },
      {
        id: 'llama-3.1-8b-instruct',
        name: 'Llama 3.1 8B Instruct',
        contextWindow: 131072,
        maxOutputTokens: 4096,
        description: 'Standard Llama 3.1 8B instruction-following model',
        pricing: { input: 0.2, output: 0.2, currency: 'USD' }
      },
      {
        id: 'llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B Instruct',
        contextWindow: 131072,
        maxOutputTokens: 4096,
        description: 'Standard Llama 3.1 70B instruction-following model',
        pricing: { input: 1.0, output: 1.0, currency: 'USD' }
      }
    ];
  }

  createLLM(modelId: string): LLM {
    return new LLM(this, modelId);
  }

  async chat(
    modelId: string,
    messages: ChatMessage[],
    options: ChatOptions,
    streamCallback?: StreamCallback
  ): Promise<ChatResult> {
    try {
      const payload = {
        model: modelId,
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        top_k: options.topK,
        stream: !!streamCallback,
        presence_penalty: options.presence_penalty || 0,
        frequency_penalty: options.frequency_penalty || 0
      };

      if (streamCallback) {
        return this.streamChat(payload, streamCallback);
      } else {
        const response = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        const content = response.data.choices[0].message.content;
        const parsed = ResponseParser.parseResponse(content);

        return {
          raw: response.data,
          parsed,
          usage: {
            inputTokens: response.data.usage?.prompt_tokens || 0,
            outputTokens: response.data.usage?.completion_tokens || 0,
            totalTokens: response.data.usage?.total_tokens || 0
          }
        };
      }
    } catch (error) {
      throw new Error(`Perplexity chat failed: ${error}`);
    }
  }

  private async streamChat(payload: any, streamCallback: StreamCallback): Promise<ChatResult> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let rawResponse: any = null;

      const source = axios.post(`${this.baseUrl}/chat/completions`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      });

      source.then(response => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                const parsed = ResponseParser.parseResponse(fullContent);
                resolve({
                  raw: rawResponse,
                  parsed,
                  usage: undefined
                });
                return;
              }
              try {
                const parsed = JSON.parse(data);
                rawResponse = parsed;
                const content = parsed.choices[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  streamCallback(content);
                }
              } catch (e) {
                // Ignore parsing errors for partial chunks
              }
            }
          }
        });

        response.data.on('error', reject);
      }).catch(reject);
    });
  }
}