import axios from 'axios';
import { Provider } from '../provider';
import { ModelInfo, ChatOptions, ChatMessage, ChatResult, StreamCallback } from '../types';
import { LLM } from '../llm';
import { ResponseParser } from '../utils/parser';

export class BedrockProvider extends Provider {
  protected region: string;
  protected accessKeyId: string;
  protected secretAccessKey: string;

  constructor(apiKey: string, baseUrl?: string, region: string = 'us-east-1') {
    super(apiKey, baseUrl);
    this.region = region;
    
    // For Bedrock, we expect the apiKey to be in format: accessKeyId:secretAccessKey
    const [accessKeyId, secretAccessKey] = apiKey.split(':');
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Bedrock requires API key in format: accessKeyId:secretAccessKey');
    }
    
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
  }

  async getModels(): Promise<ModelInfo[]> {
    // Return known Bedrock models since the ListFoundationModels API requires additional setup
    return [
      {
        id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        name: 'Claude 3.5 Sonnet v2',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        description: 'Anthropic Claude 3.5 Sonnet via AWS Bedrock',
        pricing: { input: 3.0, output: 15.0, currency: 'USD' }
      },
      {
        id: 'anthropic.claude-3-5-haiku-20241022-v1:0',
        name: 'Claude 3.5 Haiku',
        contextWindow: 200000,
        maxOutputTokens: 8192,
        description: 'Anthropic Claude 3.5 Haiku via AWS Bedrock',
        pricing: { input: 1.0, output: 5.0, currency: 'USD' }
      },
      {
        id: 'anthropic.claude-3-opus-20240229-v1:0',
        name: 'Claude 3 Opus',
        contextWindow: 200000,
        maxOutputTokens: 4096,
        description: 'Anthropic Claude 3 Opus via AWS Bedrock',
        pricing: { input: 15.0, output: 75.0, currency: 'USD' }
      },
      {
        id: 'meta.llama3-2-90b-instruct-v1:0',
        name: 'Llama 3.2 90B Instruct',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        description: 'Meta Llama 3.2 90B via AWS Bedrock',
        pricing: { input: 2.0, output: 2.0, currency: 'USD' }
      },
      {
        id: 'meta.llama3-2-11b-instruct-v1:0',
        name: 'Llama 3.2 11B Instruct',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        description: 'Meta Llama 3.2 11B via AWS Bedrock',
        pricing: { input: 0.35, output: 0.35, currency: 'USD' }
      },
      {
        id: 'mistral.mistral-large-2407-v1:0',
        name: 'Mistral Large 2407',
        contextWindow: 128000,
        maxOutputTokens: 8192,
        description: 'Mistral Large via AWS Bedrock',
        pricing: { input: 4.0, output: 12.0, currency: 'USD' }
      },
      {
        id: 'amazon.nova-pro-v1:0',
        name: 'Amazon Nova Pro',
        contextWindow: 300000,
        maxOutputTokens: 5120,
        description: 'Amazon Nova Pro multimodal model',
        pricing: { input: 0.8, output: 3.2, currency: 'USD' }
      },
      {
        id: 'amazon.nova-lite-v1:0',
        name: 'Amazon Nova Lite',
        contextWindow: 300000,
        maxOutputTokens: 5120,
        description: 'Amazon Nova Lite multimodal model',
        pricing: { input: 0.06, output: 0.24, currency: 'USD' }
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
      const modelProvider = this.getModelProvider(modelId);
      
      if (modelProvider === 'anthropic') {
        return this.chatAnthropic(modelId, messages, options, streamCallback);
      } else if (modelProvider === 'meta') {
        return this.chatMeta(modelId, messages, options, streamCallback);
      } else if (modelProvider === 'mistral') {
        return this.chatMistral(modelId, messages, options, streamCallback);
      } else if (modelProvider === 'amazon') {
        return this.chatAmazon(modelId, messages, options, streamCallback);
      } else {
        throw new Error(`Unsupported model provider: ${modelProvider}`);
      }
    } catch (error) {
      throw new Error(`Bedrock chat failed: ${error}`);
    }
  }

  private async chatAnthropic(
    modelId: string,
    messages: ChatMessage[],
    options: ChatOptions,
    streamCallback?: StreamCallback
  ): Promise<ChatResult> {
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: options.maxTokens || 4096,
      messages: userMessages.map(msg => ({
        role: msg.role,
        content: [{ type: 'text', text: msg.content }]
      })),
      temperature: options.temperature,
      top_p: options.topP,
      top_k: options.topK,
      ...(systemMessage && { system: [{ type: 'text', text: systemMessage.content }] })
    };

    const response = await this.invokeModel(modelId, body, streamCallback);
    
    if (streamCallback) {
      return response; // Already handled in streaming
    }

    const content = response.content[0].text;
    const parsed = ResponseParser.parseResponse(content);

    return {
      raw: response,
      parsed,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }

  private async chatMeta(
    modelId: string,
    messages: ChatMessage[],
    options: ChatOptions,
    streamCallback?: StreamCallback
  ): Promise<ChatResult> {
    const prompt = this.messagesToPrompt(messages);

    const body = {
      prompt: prompt,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 0.9,
      max_gen_len: options.maxTokens || 512
    };

    const response = await this.invokeModel(modelId, body, streamCallback);
    
    if (streamCallback) {
      return response; // Already handled in streaming
    }

    const content = response.generation || '';
    const parsed = ResponseParser.parseResponse(content);

    return {
      raw: response,
      parsed,
      usage: {
        inputTokens: response.prompt_token_count || 0,
        outputTokens: response.generation_token_count || 0,
        totalTokens: (response.prompt_token_count || 0) + (response.generation_token_count || 0)
      }
    };
  }

  private async chatMistral(
    modelId: string,
    messages: ChatMessage[],
    options: ChatOptions,
    streamCallback?: StreamCallback
  ): Promise<ChatResult> {
    const prompt = `<s>${this.messagesToPrompt(messages)}`;

    const body = {
      prompt: prompt,
      temperature: options.temperature || 0.7,
      top_p: options.topP || 0.7,
      top_k: options.topK || 50,
      max_tokens: options.maxTokens || 512,
      stop: ['</s>']
    };

    const response = await this.invokeModel(modelId, body, streamCallback);
    
    if (streamCallback) {
      return response; // Already handled in streaming
    }

    const content = response.outputs[0].text || '';
    const parsed = ResponseParser.parseResponse(content);

    return {
      raw: response,
      parsed,
      usage: {
        inputTokens: 0, // Mistral on Bedrock doesn't provide token counts
        outputTokens: 0,
        totalTokens: 0
      }
    };
  }

  private async chatAmazon(
    modelId: string,
    messages: ChatMessage[],
    options: ChatOptions,
    streamCallback?: StreamCallback
  ): Promise<ChatResult> {
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const body = {
      messages: userMessages.map(msg => ({
        role: msg.role,
        content: [{ text: msg.content }]
      })),
      inferenceConfig: {
        temperature: options.temperature || 0.7,
        topP: options.topP || 0.9,
        maxTokens: options.maxTokens || 4096
      },
      ...(systemMessage && { 
        system: [{ text: systemMessage.content }] 
      })
    };

    const response = await this.invokeModel(modelId, body, streamCallback);
    
    if (streamCallback) {
      return response; // Already handled in streaming
    }

    const content = response.output?.message?.content?.[0]?.text || '';
    const parsed = ResponseParser.parseResponse(content);

    return {
      raw: response,
      parsed,
      usage: {
        inputTokens: response.usage?.inputTokens || 0,
        outputTokens: response.usage?.outputTokens || 0,
        totalTokens: response.usage?.totalTokens || 0
      }
    };
  }

  private async invokeModel(modelId: string, body: any, streamCallback?: StreamCallback): Promise<any> {
    // Note: This is a simplified implementation
    // In a real implementation, you would need to:
    // 1. Sign the request using AWS Signature Version 4
    // 2. Handle different response formats for different models
    // 3. Implement proper streaming for Bedrock
    
    const url = `https://bedrock-runtime.${this.region}.amazonaws.com/model/${modelId}/invoke${streamCallback ? '-with-response-stream' : ''}`;
    
    // This is a placeholder - real AWS requests require proper signing
    throw new Error('Bedrock implementation requires AWS SDK and proper authentication setup. Please use AWS SDK directly for production use.');
  }

  private getModelProvider(modelId: string): string {
    if (modelId.startsWith('anthropic.')) return 'anthropic';
    if (modelId.startsWith('meta.')) return 'meta';
    if (modelId.startsWith('mistral.')) return 'mistral';
    if (modelId.startsWith('amazon.')) return 'amazon';
    return 'unknown';
  }

  private messagesToPrompt(messages: ChatMessage[]): string {
    let prompt = '';
    
    for (const message of messages) {
      if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    return prompt + 'Assistant: ';
  }
}