import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class OpenRouterProvider extends Provider {
  protected baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    super(apiKey, baseUrl);
    this.baseUrl = baseUrl || 'https://openrouter.ai/api/v1';
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
        contextWindow: model.context_length || 4096,
        maxOutputTokens: model.max_completion_tokens,
        description: model.description,
        pricing: model.pricing ? {
          input: parseFloat(model.pricing.prompt) * 1000000, // Convert to per million tokens
          output: parseFloat(model.pricing.completion) * 1000000,
          currency: 'USD'
        } : undefined
      }));
    } catch (error) {
      throw new Error(`Failed to fetch OpenRouter models: ${error}`);
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
        stream: !!streamCallback
      };

      if (streamCallback) {
        return this.streamChat(payload, streamCallback);
      } else {
        const response = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/multi-llm/multi-llm',
            'X-Title': 'Multi-LLM Package'
          }
        });

        // Debug logging for response structure
        if (!response.data.choices || response.data.choices.length === 0) {
          console.error('OpenRouter response missing choices:', response.data);
          throw new Error('OpenRouter response missing choices array');
        }

        const message = response.data.choices[0].message;
        
        // OpenRouter may return content in different fields depending on model
        let content = message?.content || '';
        
        // Some models use reasoning field for the actual response
        if (!content && message?.reasoning) {
          content = message.reasoning;
        }
        
        // Debug empty content (only in development/testing)
        if (!content && process.env.NODE_ENV !== 'production') {
          console.warn('OpenRouter returned empty content:', {
            choices: response.data.choices,
            message: message,
            content: content
          });
        }

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
      throw new Error(`OpenRouter chat failed: ${error}`);
    }
  }

  private async streamChat(payload: any, streamCallback: StreamCallback): Promise<ChatResult> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let rawResponse: any = null;

      const source = axios.post(`${this.baseUrl}/chat/completions`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/multi-llm/multi-llm',
          'X-Title': 'Multi-LLM Package'
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
                
                // Handle both content and reasoning fields for streaming
                const delta = parsed.choices[0]?.delta;
                let content = delta?.content || '';
                
                // Some models stream in reasoning field
                if (!content && delta?.reasoning) {
                  content = delta.reasoning;
                }
                
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