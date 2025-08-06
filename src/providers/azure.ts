import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class AzureProvider extends Provider {
  protected baseUrl: string;
  protected apiVersion: string;

  constructor(apiKey: string, baseUrl?: string, apiVersion: string = '2024-02-15-preview') {
    super(apiKey, baseUrl);
    if (!baseUrl) {
      throw new Error('Azure baseUrl is required (e.g., https://your-resource.openai.azure.com)');
    }
    this.baseUrl = baseUrl;
    this.apiVersion = apiVersion;
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/openai/models?api-version=${this.apiVersion}`, {
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      return response.data.data.map((model: any) => ({
        id: model.id,
        name: model.id,
        contextWindow: this.getContextWindow(model.id),
        maxOutputTokens: this.getMaxOutputTokens(model.id),
        pricing: this.getPricing(model.id)
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Azure OpenAI models: ${error}`);
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
        messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stream: !!streamCallback
      };

      const url = `${this.baseUrl}/openai/deployments/${modelId}/chat/completions?api-version=${this.apiVersion}`;

      if (streamCallback) {
        return this.streamChat(url, payload, streamCallback);
      } else {
        const response = await axios.post(url, payload, {
          headers: {
            'api-key': this.apiKey,
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
      throw new Error(`Azure OpenAI chat failed: ${error}`);
    }
  }

  private async streamChat(url: string, payload: any, streamCallback: StreamCallback): Promise<ChatResult> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let rawResponse: any = null;

      const source = axios.post(url, payload, {
        headers: {
          'api-key': this.apiKey,
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
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-35-turbo': 16385
    };
    return contextWindows[modelId] || 8192;
  }

  private getMaxOutputTokens(modelId: string): number {
    const maxOutputTokens: Record<string, number> = {
      'gpt-4o': 4096,
      'gpt-4o-mini': 16384,
      'gpt-4-turbo': 4096,
      'gpt-4': 4096,
      'gpt-35-turbo': 4096
    };
    return maxOutputTokens[modelId] || 4096;
  }

  private getPricing(modelId: string): { input: number; output: number; currency: string } | undefined {
    // Azure pricing varies by region and deployment, so we return undefined
    return undefined;
  }
}