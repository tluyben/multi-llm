import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class OllamaProvider extends Provider {
  protected baseUrl: string;

  constructor(apiKey: string = '', baseUrl?: string) {
    super(apiKey, baseUrl);
    this.baseUrl = baseUrl || 'http://localhost:11434';
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      
      return response.data.models.map((model: any) => ({
        id: model.name,
        name: model.name,
        contextWindow: 4096, // Default, Ollama doesn't provide this info
        maxOutputTokens: 4096,
        description: `Size: ${model.size}, Modified: ${model.modified_at}`
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Ollama models: ${error}`);
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
        stream: !!streamCallback,
        options: {
          temperature: options.temperature,
          top_p: options.topP,
          top_k: options.topK,
          num_predict: options.maxTokens
        }
      };

      if (streamCallback) {
        return this.streamChat(payload, streamCallback);
      } else {
        const response = await axios.post(`${this.baseUrl}/api/chat`, payload);

        const content = response.data.message.content;
        const parsed = ResponseParser.parseResponse(content);

        return {
          raw: response.data,
          parsed,
          usage: {
            inputTokens: response.data.prompt_eval_count || 0,
            outputTokens: response.data.eval_count || 0,
            totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0)
          }
        };
      }
    } catch (error) {
      throw new Error(`Ollama chat failed: ${error}`);
    }
  }

  private async streamChat(payload: any, streamCallback: StreamCallback): Promise<ChatResult> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      let rawResponse: any = null;

      const source = axios.post(`${this.baseUrl}/api/chat`, payload, {
        responseType: 'stream'
      });

      source.then(response => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              rawResponse = parsed;
              
              if (parsed.message?.content) {
                const content = parsed.message.content;
                fullContent += content;
                streamCallback(content);
              }
              
              if (parsed.done) {
                const parsedResult = ResponseParser.parseResponse(fullContent);
                resolve({
                  raw: rawResponse,
                  parsed: parsedResult,
                  usage: {
                    inputTokens: parsed.prompt_eval_count || 0,
                    outputTokens: parsed.eval_count || 0,
                    totalTokens: (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0)
                  }
                });
                return;
              }
            } catch (e) {
              // Ignore parsing errors for partial chunks
            }
          }
        });

        response.data.on('error', reject);
      }).catch(reject);
    });
  }
}