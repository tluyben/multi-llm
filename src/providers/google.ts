import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class GoogleProvider extends Provider {
  protected baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    super(apiKey, baseUrl);
    this.baseUrl = baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/models?key=${this.apiKey}`);
      
      return response.data.models
        .filter((model: any) => model.supportedGenerationMethods?.includes('generateContent'))
        .map((model: any) => ({
          id: model.name.replace('models/', ''),
          name: model.displayName || model.name,
          contextWindow: this.getContextWindow(model.name),
          maxOutputTokens: this.getMaxOutputTokens(model.name),
          description: model.description,
          pricing: this.getPricing(model.name)
        }));
    } catch (error) {
      throw new Error(`Failed to fetch Google models: ${error}`);
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
      // Convert messages to Google format
      const contents = this.convertMessages(messages);
      
      const payload = {
        contents,
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
          topP: options.topP,
          topK: options.topK,
        }
      };

      if (streamCallback) {
        return this.streamChat(modelId, payload, streamCallback);
      } else {
        const response = await axios.post(
          `${this.baseUrl}/models/${modelId}:generateContent?key=${this.apiKey}`,
          payload,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        const content = response.data.candidates[0]?.content?.parts[0]?.text || '';
        const parsed = ResponseParser.parseResponse(content);

        return {
          raw: response.data,
          parsed,
          usage: {
            inputTokens: response.data.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.data.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.data.usageMetadata?.totalTokenCount || 0
          }
        };
      }
    } catch (error) {
      throw new Error(`Google chat failed: ${error}`);
    }
  }

  private async streamChat(modelId: string, payload: any, streamCallback: StreamCallback): Promise<ChatResult> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let rawResponse: any = null;

      const source = axios.post(
        `${this.baseUrl}/models/${modelId}:streamGenerateContent?key=${this.apiKey}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      source.then(response => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                rawResponse = parsed;
                
                const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (content) {
                  fullContent += content;
                  streamCallback(content);
                }
                
                if (parsed.candidates?.[0]?.finishReason) {
                  const parsedResult = ResponseParser.parseResponse(fullContent);
                  resolve({
                    raw: rawResponse,
                    parsed: parsedResult,
                    usage: {
                      inputTokens: parsed.usageMetadata?.promptTokenCount || 0,
                      outputTokens: parsed.usageMetadata?.candidatesTokenCount || 0,
                      totalTokens: parsed.usageMetadata?.totalTokenCount || 0
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
    const contents: any[] = [];
    
    for (const message of messages) {
      if (message.role === 'system') {
        // Google doesn't have a system role, prepend to first user message
        continue;
      }
      
      contents.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }]
      });
    }
    
    // Add system message to first user message if present
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }
    
    return contents;
  }

  private getContextWindow(modelName: string): number {
    const contextWindows: Record<string, number> = {
      'gemini-2.5-pro': 2000000,
      'gemini-2.5-flash': 1000000,
      'gemini-1.5-pro': 2000000,
      'gemini-1.5-flash': 1000000,
      'gemini-pro': 32768,
    };
    
    const modelId = modelName.replace('models/', '');
    return contextWindows[modelId] || 32768;
  }

  private getMaxOutputTokens(modelName: string): number {
    const maxOutputTokens: Record<string, number> = {
      'gemini-2.5-pro': 8192,
      'gemini-2.5-flash': 8192,
      'gemini-1.5-pro': 8192,
      'gemini-1.5-flash': 8192,
      'gemini-pro': 2048,
    };
    
    const modelId = modelName.replace('models/', '');
    return maxOutputTokens[modelId] || 2048;
  }

  private getPricing(modelName: string): { input: number; output: number; currency: string } | undefined {
    // Google pricing varies by region and usage tier
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-2.5-pro': { input: 1.25, output: 5.0 },
      'gemini-2.5-flash': { input: 0.075, output: 0.3 },
      'gemini-1.5-pro': { input: 1.25, output: 5.0 },
      'gemini-1.5-flash': { input: 0.075, output: 0.3 },
      'gemini-pro': { input: 0.5, output: 1.5 },
    };
    
    const modelId = modelName.replace('models/', '');
    const modelPricing = pricing[modelId];
    return modelPricing ? { ...modelPricing, currency: 'USD' } : undefined;
  }
}