import { ParsedResult } from '../types';

export class ResponseParser {
  static parseResponse(content: string): ParsedResult {
    const codeBlocks: Array<{ language: string; code: string }> = [];
    let thinking: string | undefined;
    
    // Extract code blocks
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }
    
    // Extract thinking blocks (common patterns)
    const thinkingPatterns = [
      /<thinking>([\s\S]*?)<\/thinking>/,
      /<thought>([\s\S]*?)<\/thought>/,
      /\[thinking\]([\s\S]*?)\[\/thinking\]/
    ];
    
    for (const pattern of thinkingPatterns) {
      const thinkingMatch = content.match(pattern);
      if (thinkingMatch) {
        thinking = thinkingMatch[1].trim();
        break;
      }
    }
    
    // Clean content by removing code blocks and thinking
    let cleanContent = content;
    cleanContent = cleanContent.replace(/```[\w]*\n[\s\S]*?```/g, '');
    for (const pattern of thinkingPatterns) {
      cleanContent = cleanContent.replace(pattern, '');
    }
    cleanContent = cleanContent.trim();
    
    return {
      content: cleanContent,
      codeBlocks,
      thinking,
      toolCalls: [] // Will be populated by individual providers
    };
  }
}