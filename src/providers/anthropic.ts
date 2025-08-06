import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class AnthropicProvider extends Provider {
  protected baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    super(apiKey, baseUrl);
    this.baseUrl = baseUrl || 'https://api.anthropic.com/v1';
  }

  async getModels(): Promise<ModelInfo[]> {
    // Anthropic doesn't have a models endpoint, so we return known models
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        pricing: { input: 0.003, output: 0.015, currency: 'USD' }
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        pricing: { input: 0.001, output: 0.005, currency: 'USD' }
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        pricing: { input: 0.015, output: 0.075, currency: 'USD' }
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
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');

      const payload = {
        model: modelId,
        max_tokens: options.maxTokens || 4096,
        messages: userMessages.map(msg => ({ role: msg.role, content: msg.content })),
        temperature: options.temperature,
        top_p: options.topP,
        top_k: options.topK,
        stream: !!streamCallback,
        ...(systemMessage && { system: systemMessage.content })
      };

      if (streamCallback) {
        return this.streamChat(payload, streamCallback);
      } else {
        const response = await axios.post(`${this.baseUrl}/messages`, payload, {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        });

        const content = response.data.content[0].text;
        const parsed = ResponseParser.parseResponse(content);

        return {
          raw: response.data,
          parsed,
          usage: {
            inputTokens: response.data.usage?.input_tokens || 0,
            outputTokens: response.data.usage?.output_tokens || 0,
            totalTokens: (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0)
          }
        };
      }
    } catch (error) {
      throw new Error(`Anthropic chat failed: ${error}`);
    }
  }

  private async streamChat(payload: any, streamCallback: StreamCallback): Promise<ChatResult> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let rawResponse: any = null;

      const source = axios.post(`${this.baseUrl}/messages`, payload, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
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
              try {
                const parsed = JSON.parse(data);
                rawResponse = parsed;
                
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  const content = parsed.delta.text;
                  fullContent += content;
                  streamCallback(content);
                } else if (parsed.type === 'message_stop') {
                  const parsedResult = ResponseParser.parseResponse(fullContent);
                  resolve({
                    raw: rawResponse,
                    parsed: parsedResult,
                    usage: undefined
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
}