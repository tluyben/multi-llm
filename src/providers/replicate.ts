import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class ReplicateProvider extends Provider {
  protected baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    super(apiKey, baseUrl);
    this.baseUrl = baseUrl || 'https://api.replicate.com/v1';
  }

  async getModels(): Promise<ModelInfo[]> {
    // Return popular language models available on Replicate
    return [
      {
        id: 'meta/llama-2-70b-chat',
        name: 'Llama 2 70B Chat',
        contextWindow: 4096,
        maxOutputTokens: 4096,
        description: 'A 70 billion parameter language model from Meta',
        pricing: { input: 0.65, output: 2.75, currency: 'USD' }
      },
      {
        id: 'meta/llama-2-13b-chat',
        name: 'Llama 2 13B Chat',
        contextWindow: 4096,
        maxOutputTokens: 4096,
        description: 'A 13 billion parameter language model from Meta',
        pricing: { input: 0.1, output: 0.5, currency: 'USD' }
      },
      {
        id: 'meta/llama-2-7b-chat',
        name: 'Llama 2 7B Chat',
        contextWindow: 4096,
        maxOutputTokens: 4096,
        description: 'A 7 billion parameter language model from Meta',
        pricing: { input: 0.05, output: 0.25, currency: 'USD' }
      },
      {
        id: 'mistralai/mixtral-8x7b-instruct-v0.1',
        name: 'Mixtral 8x7B Instruct',
        contextWindow: 32768,
        maxOutputTokens: 4096,
        description: 'A mixture of experts model by Mistral AI',
        pricing: { input: 0.3, output: 1.0, currency: 'USD' }
      },
      {
        id: 'mistralai/mistral-7b-instruct-v0.2',
        name: 'Mistral 7B Instruct v0.2',
        contextWindow: 32768,
        maxOutputTokens: 4096,
        description: 'Mistral 7B fine-tuned for instruction following',
        pricing: { input: 0.05, output: 0.25, currency: 'USD' }
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
      // Convert messages to a prompt format that Replicate expects
      const prompt = this.messagesToPrompt(messages);
      
      const payload = {
        input: {
          prompt: prompt,
          temperature: options.temperature || 0.7,
          max_new_tokens: options.maxTokens || 512,
          top_p: options.topP || 0.9,
          repetition_penalty: options.repetition_penalty || 1.0,
          system_prompt: messages.find(m => m.role === 'system')?.content
        }
      };

      if (streamCallback) {
        return this.streamChat(modelId, payload, streamCallback);
      } else {
        const response = await axios.post(`${this.baseUrl}/predictions`, {
          version: await this.getModelVersion(modelId),
          input: payload.input
        }, {
          headers: {
            'Authorization': `Token ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        // Poll for completion
        const result = await this.pollForCompletion(response.data.urls.get);
        const content = Array.isArray(result.output) ? result.output.join('') : result.output || '';
        const parsed = ResponseParser.parseResponse(content);

        return {
          raw: result,
          parsed,
          usage: {
            inputTokens: 0, // Replicate doesn't provide token counts
            outputTokens: 0,
            totalTokens: 0
          }
        };
      }
    } catch (error) {
      throw new Error(`Replicate chat failed: ${error}`);
    }
  }

  private async streamChat(modelId: string, payload: any, streamCallback: StreamCallback): Promise<ChatResult> {
    // Replicate streaming is complex and requires Server-Sent Events
    // For now, simulate streaming by polling the prediction
    return new Promise(async (resolve, reject) => {
      try {
        const response = await axios.post(`${this.baseUrl}/predictions`, {
          version: await this.getModelVersion(modelId),
          input: payload.input
        }, {
          headers: {
            'Authorization': `Token ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        const result = await this.pollForCompletion(response.data.urls.get);
        const content = Array.isArray(result.output) ? result.output.join('') : result.output || '';
        
        // Simulate streaming by sending content in chunks
        await this.simulateStreaming(content, streamCallback);
        
        const parsed = ResponseParser.parseResponse(content);
        resolve({
          raw: result,
          parsed,
          usage: undefined
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async simulateStreaming(content: string, streamCallback: StreamCallback): Promise<void> {
    const words = content.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      streamCallback(word);
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private async pollForCompletion(pollUrl: string): Promise<any> {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    
    while (attempts < maxAttempts) {
      const response = await axios.get(pollUrl, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      if (response.data.status === 'succeeded') {
        return response.data;
      } else if (response.data.status === 'failed') {
        throw new Error(`Prediction failed: ${response.data.error}`);
      }

      // Wait 5 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error('Prediction timed out');
  }

  private async getModelVersion(modelId: string): Promise<string> {
    // This would normally fetch the latest version from Replicate's API
    // For now, return hardcoded versions for known models
    const versions: Record<string, string> = {
      'meta/llama-2-70b-chat': '02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3',
      'meta/llama-2-13b-chat': '56acad22679f6b95d6e45c78309a2b50a670df5ed8669fdc76e5c736b68a6ca5',
      'meta/llama-2-7b-chat': '8e6975e5ed6174911a6ff3d60540dfd4844201974602551e10e9e87ab143d81e',
      'mistralai/mixtral-8x7b-instruct-v0.1': 'cf18decbf51eaac758b70c20e36c1b31e76f9b0b30d61e8b8a2bf50e21b0fe9d',
      'mistralai/mistral-7b-instruct-v0.2': '4c960b7ab05b1d9ed6d9b7d6b38b0b59f6c71d5b5b3e1c6f5b3b7f9b5c3b4f8e'
    };
    
    return versions[modelId] || versions['meta/llama-2-7b-chat'];
  }

  private messagesToPrompt(messages: ChatMessage[]): string {
    let prompt = '';
    
    for (const message of messages) {
      if (message.role === 'system') {
        continue; // System message handled separately
      } else if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    prompt += 'Assistant: ';
    return prompt;
  }
}