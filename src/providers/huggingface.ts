import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class HuggingFaceProvider extends Provider {
  protected baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    super(apiKey, baseUrl);
    this.baseUrl = baseUrl || 'https://api-inference.huggingface.co';
  }

  async getModels(): Promise<ModelInfo[]> {
    // Return popular text-generation models available on HuggingFace Inference API
    return [
      {
        id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        name: 'Mixtral 8x7B Instruct v0.1',
        contextWindow: 32768,
        maxOutputTokens: 4096,
        description: 'Mixture of experts model by Mistral AI',
        pricing: { input: 0.5, output: 0.5, currency: 'USD' }
      },
      {
        id: 'mistralai/Mistral-7B-Instruct-v0.2',
        name: 'Mistral 7B Instruct v0.2',
        contextWindow: 32768,
        maxOutputTokens: 4096,
        description: 'Mistral 7B fine-tuned for instruction following',
        pricing: { input: 0.2, output: 0.2, currency: 'USD' }
      },
      {
        id: 'meta-llama/Llama-2-70b-chat-hf',
        name: 'Llama 2 70B Chat HF',
        contextWindow: 4096,
        maxOutputTokens: 4096,
        description: 'Meta Llama 2 70B optimized for dialogue use cases',
        pricing: { input: 1.0, output: 1.0, currency: 'USD' }
      },
      {
        id: 'meta-llama/Llama-2-13b-chat-hf',
        name: 'Llama 2 13B Chat HF',
        contextWindow: 4096,
        maxOutputTokens: 4096,
        description: 'Meta Llama 2 13B optimized for dialogue use cases',
        pricing: { input: 0.3, output: 0.3, currency: 'USD' }
      },
      {
        id: 'meta-llama/Llama-2-7b-chat-hf',
        name: 'Llama 2 7B Chat HF',
        contextWindow: 4096,
        maxOutputTokens: 4096,
        description: 'Meta Llama 2 7B optimized for dialogue use cases',
        pricing: { input: 0.1, output: 0.1, currency: 'USD' }
      },
      {
        id: 'microsoft/DialoGPT-large',
        name: 'DialoGPT Large',
        contextWindow: 1024,
        maxOutputTokens: 1024,
        description: 'Large-scale pretrained dialogue response generation model',
        pricing: { input: 0.1, output: 0.1, currency: 'USD' }
      },
      {
        id: 'microsoft/DialoGPT-medium',
        name: 'DialoGPT Medium',
        contextWindow: 1024,
        maxOutputTokens: 1024,
        description: 'Medium-scale pretrained dialogue response generation model',
        pricing: { input: 0.05, output: 0.05, currency: 'USD' }
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
      // Convert messages to text format for HuggingFace
      const prompt = this.messagesToPrompt(messages);
      
      const payload = {
        inputs: prompt,
        parameters: {
          temperature: options.temperature || 0.7,
          max_new_tokens: options.maxTokens || 512,
          top_p: options.topP || 0.9,
          top_k: options.topK || 50,
          repetition_penalty: options.repetition_penalty || 1.0,
          do_sample: true,
          return_full_text: false
        },
        options: {
          wait_for_model: true
        }
      };

      if (streamCallback) {
        return this.streamChat(modelId, payload, streamCallback);
      } else {
        const response = await axios.post(`${this.baseUrl}/models/${modelId}`, payload, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        // HuggingFace returns an array with generated text
        const generatedText = Array.isArray(response.data) ? response.data[0]?.generated_text : response.data.generated_text;
        const content = generatedText || '';
        const parsed = ResponseParser.parseResponse(content);

        return {
          raw: response.data,
          parsed,
          usage: {
            inputTokens: 0, // HuggingFace doesn't provide detailed token counts in free tier
            outputTokens: 0,
            totalTokens: 0
          }
        };
      }
    } catch (error) {
      throw new Error(`HuggingFace chat failed: ${error}`);
    }
  }

  private async streamChat(modelId: string, payload: any, streamCallback: StreamCallback): Promise<ChatResult> {
    return new Promise((resolve, reject) => {
      let fullContent = '';
      
      // HuggingFace Inference API doesn't support streaming in the free tier
      // We'll simulate streaming by making a regular request and chunking the response
      const source = axios.post(`${this.baseUrl}/models/${modelId}`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      source.then(response => {
        const generatedText = Array.isArray(response.data) ? response.data[0]?.generated_text : response.data.generated_text;
        const content = generatedText || '';
        
        // Simulate streaming by sending content in chunks
        this.simulateStreaming(content, streamCallback).then(() => {
          const parsed = ResponseParser.parseResponse(content);
          resolve({
            raw: response.data,
            parsed,
            usage: undefined
          });
        });
      }).catch(reject);
    });
  }

  private async simulateStreaming(content: string, streamCallback: StreamCallback): Promise<void> {
    const words = content.split(' ');
    let currentContent = '';
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      currentContent += word;
      streamCallback(word);
      
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  private messagesToPrompt(messages: ChatMessage[]): string {
    let prompt = '';
    
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      prompt += `System: ${systemMessage.content}\n\n`;
    }
    
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    for (let i = 0; i < conversationMessages.length; i++) {
      const message = conversationMessages[i];
      if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    // Add the assistant prompt to indicate where the response should start
    if (conversationMessages[conversationMessages.length - 1]?.role === 'user') {
      prompt += 'Assistant: ';
    }
    
    return prompt;
  }
}