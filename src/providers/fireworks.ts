import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class FireworksProvider extends Provider {
  protected baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    super(apiKey, baseUrl);
    this.baseUrl = baseUrl || 'https://api.fireworks.ai/inference/v1';
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.data
        .filter((model: any) => model.object === 'model')
        .map((model: any) => ({
          id: model.id,
          name: model.id,
          contextWindow: this.getContextWindow(model.id),
          maxOutputTokens: this.getMaxOutputTokens(model.id),
          pricing: this.getPricing(model.id)
        }));
    } catch (error) {
      throw new Error(`Failed to fetch Fireworks AI models: ${error}`);
    }
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
        response_format: options.response_format
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
      throw new Error(`Fireworks AI chat failed: ${error}`);
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

  private getContextWindow(modelId: string): number {
    const contextWindows: Record<string, number> = {
      'accounts/fireworks/models/llama-v3p1-405b-instruct': 131072,
      'accounts/fireworks/models/llama-v3p1-70b-instruct': 131072,
      'accounts/fireworks/models/llama-v3p1-8b-instruct': 131072,
      'accounts/fireworks/models/llama-v3-70b-instruct': 8192,
      'accounts/fireworks/models/mixtral-8x7b-instruct': 32768,
      'accounts/fireworks/models/qwen2-72b-instruct': 32768,
    };
    return contextWindows[modelId] || 8192;
  }

  private getMaxOutputTokens(modelId: string): number {
    return 4096; // Standard for most Fireworks models
  }

  private getPricing(modelId: string): { input: number; output: number; currency: string } | undefined {
    const pricing: Record<string, { input: number; output: number }> = {
      'accounts/fireworks/models/llama-v3p1-405b-instruct': { input: 3.0, output: 3.0 },
      'accounts/fireworks/models/llama-v3p1-70b-instruct': { input: 0.9, output: 0.9 },
      'accounts/fireworks/models/llama-v3p1-8b-instruct': { input: 0.2, output: 0.2 },
      'accounts/fireworks/models/llama-v3-70b-instruct': { input: 0.7, output: 0.8 },
      'accounts/fireworks/models/mixtral-8x7b-instruct': { input: 0.5, output: 0.5 },
      'accounts/fireworks/models/qwen2-72b-instruct': { input: 0.9, output: 0.9 },
    };
    
    const modelPricing = pricing[modelId];
    return modelPricing ? { ...modelPricing, currency: 'USD' } : undefined;
  }
}