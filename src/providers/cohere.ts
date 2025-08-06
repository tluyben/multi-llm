import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class CohereProvider extends Provider {
  protected baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    super(apiKey, baseUrl);
    this.baseUrl = baseUrl || 'https://api.cohere.com/v2';
  }

  async getModels(): Promise<ModelInfo[]> {
    // Cohere doesn't have a public models endpoint, return known models
    return [
      {
        id: 'command-r-plus-08-2024',
        name: 'Command R+ (08-2024)',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        pricing: { input: 2.5, output: 10.0, currency: 'USD' }
      },
      {
        id: 'command-r-08-2024',
        name: 'Command R (08-2024)',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        pricing: { input: 0.15, output: 0.6, currency: 'USD' }
      },
      {
        id: 'command-r-plus',
        name: 'Command R+',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        pricing: { input: 3.0, output: 15.0, currency: 'USD' }
      },
      {
        id: 'command-r',
        name: 'Command R',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        pricing: { input: 0.5, output: 1.5, currency: 'USD' }
      },
      {
        id: 'command',
        name: 'Command',
        contextWindow: 4096,
        maxOutputTokens: 4096,
        pricing: { input: 1.0, output: 2.0, currency: 'USD' }
      },
      {
        id: 'command-nightly',
        name: 'Command Nightly',
        contextWindow: 4096,
        maxOutputTokens: 4096,
        pricing: { input: 1.0, output: 2.0, currency: 'USD' }
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
      const cohereMessages = this.convertMessages(messages);
      const systemMessage = messages.find(m => m.role === 'system')?.content;

      const payload = {
        model: modelId,
        messages: cohereMessages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        p: options.topP,
        k: options.topK,
        stream: !!streamCallback,
        ...(systemMessage && { system: systemMessage })
      };

      if (streamCallback) {
        return this.streamChat(payload, streamCallback);
      } else {
        const response = await axios.post(`${this.baseUrl}/chat`, payload, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        const content = response.data.message?.content?.[0]?.text || '';
        const parsed = ResponseParser.parseResponse(content);

        return {
          raw: response.data,
          parsed,
          usage: {
            inputTokens: response.data.usage?.billed_units?.input_tokens || 0,
            outputTokens: response.data.usage?.billed_units?.output_tokens || 0,
            totalTokens: (response.data.usage?.billed_units?.input_tokens || 0) + (response.data.usage?.billed_units?.output_tokens || 0)
          }
        };
      }
    } catch (error) {
      throw new Error(`Cohere chat failed: ${error}`);
    }
  }

  private async streamChat(payload: any, streamCallback: StreamCallback): Promise<ChatResult> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let rawResponse: any = null;

      const source = axios.post(`${this.baseUrl}/chat`, payload, {
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
            if (line.trim().startsWith('data: ')) {
              const data = line.slice(6).trim();
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
                
                if (parsed.type === 'content-delta') {
                  const content = parsed.delta?.message?.content?.text || '';
                  if (content) {
                    fullContent += content;
                    streamCallback(content);
                  }
                } else if (parsed.type === 'message-end') {
                  const parsedResult = ResponseParser.parseResponse(fullContent);
                  resolve({
                    raw: rawResponse,
                    parsed: parsedResult,
                    usage: {
                      inputTokens: parsed.delta?.usage?.billed_units?.input_tokens || 0,
                      outputTokens: parsed.delta?.usage?.billed_units?.output_tokens || 0,
                      totalTokens: (parsed.delta?.usage?.billed_units?.input_tokens || 0) + (parsed.delta?.usage?.billed_units?.output_tokens || 0)
                    }
                  });
                  return;
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

  private convertMessages(messages: ChatMessage[]): any[] {
    return messages
      .filter(m => m.role !== 'system') // System message handled separately
      .map(msg => ({
        role: msg.role,
        content: [{ type: 'text', text: msg.content }]
      }));
  }
}