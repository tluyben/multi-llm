import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class MistralProvider extends Provider {
  protected baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    super(apiKey, baseUrl);
    this.baseUrl = baseUrl || 'https://api.mistral.ai/v1';
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.data.map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
        contextWindow: this.getContextWindow(model.id),
        maxOutputTokens: this.getMaxOutputTokens(model.id),
        description: model.description,
        pricing: this.getPricing(model.id)
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Mistral models: ${error}`);
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
        stream: !!streamCallback,
        random_seed: options.seed,
        safe_prompt: false // Allow all content
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
      throw new Error(`Mistral chat failed: ${error}`);
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
      'mistral-large-latest': 128000,
      'mistral-large-2411': 128000,
      'mistral-large-2407': 128000,
      'mistral-medium-latest': 32768,
      'mistral-small-latest': 32768,
      'mistral-small-2409': 32768,
      'open-mistral-nemo': 128000,
      'open-mistral-7b': 32768,
      'open-mixtral-8x7b': 32768,
      'open-mixtral-8x22b': 65536,
      'codestral-latest': 32768,
      'mistral-embed': 8192
    };
    return contextWindows[modelId] || 32768;
  }

  private getMaxOutputTokens(modelId: string): number {
    const maxOutputTokens: Record<string, number> = {
      'mistral-large-latest': 8192,
      'mistral-large-2411': 8192,
      'mistral-large-2407': 8192,
      'mistral-medium-latest': 8192,
      'mistral-small-latest': 8192,
      'mistral-small-2409': 8192,
      'open-mistral-nemo': 8192,
      'open-mistral-7b': 8192,
      'open-mixtral-8x7b': 8192,
      'open-mixtral-8x22b': 8192,
      'codestral-latest': 8192,
    };
    return maxOutputTokens[modelId] || 8192;
  }

  private getPricing(modelId: string): { input: number; output: number; currency: string } | undefined {
    const pricing: Record<string, { input: number; output: number }> = {
      'mistral-large-latest': { input: 2.0, output: 6.0 },
      'mistral-large-2411': { input: 2.0, output: 6.0 },
      'mistral-large-2407': { input: 2.0, output: 6.0 },
      'mistral-medium-latest': { input: 0.7, output: 2.1 },
      'mistral-small-latest': { input: 0.2, output: 0.6 },
      'mistral-small-2409': { input: 0.2, output: 0.6 },
      'open-mistral-nemo': { input: 0.3, output: 0.3 },
      'open-mistral-7b': { input: 0.25, output: 0.25 },
      'open-mixtral-8x7b': { input: 0.7, output: 0.7 },
      'open-mixtral-8x22b': { input: 2.0, output: 6.0 },
      'codestral-latest': { input: 0.2, output: 0.6 }
    };
    
    const modelPricing = pricing[modelId];
    return modelPricing ? { ...modelPricing, currency: 'USD' } : undefined;
  }
}