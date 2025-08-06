import { Provider } from './provider';
import { ChatMessage, ChatOptions, ChatResult, StreamCallback } from './types';
import { executeWithRetry, getRetryConfig } from './utils/retry';
import { spawn, ChildProcess } from 'child_process';

export class LLM {
  private provider: Provider;
  private modelId: string;
  private mcpProcesses: ChildProcess[] = [];

  constructor(provider: Provider, modelId: string) {
    this.provider = provider;
    this.modelId = modelId;
  }

  addMCP(startupCommand: string): void {
    const [command, ...args] = startupCommand.split(' ');
    const process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.mcpProcesses.push(process);
  }

  async chat(
    content: string,
    options: ChatOptions = {},
    streamCallback?: StreamCallback
  ): Promise<ChatResult> {
    const messages: ChatMessage[] = [
      { role: 'user', content }
    ];

    if (options.system) {
      messages.unshift({ role: 'system', content: options.system });
    }

    const retryConfig = getRetryConfig(options);
    
    return executeWithRetry(
      async () => this.provider.chat(this.modelId, messages, options, streamCallback),
      retryConfig,
      `${this.provider.constructor.name}:${this.modelId}`
    );
  }

  dispose(): void {
    this.mcpProcesses.forEach(process => {
      if (!process.killed) {
        process.kill();
      }
    });
    this.mcpProcesses = [];
  }
}