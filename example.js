const { MultiLLM } = require('./dist/index');

async function main() {
  // Example 1: Using OpenAI
  console.log('=== OpenAI Example ===');
  const openaiProvider = MultiLLM.createProvider('openai', process.env.OPENAI_API_KEY);
  
  const models = await openaiProvider.getModels();
  console.log('Available models:', models.slice(0, 3).map(m => ({ id: m.id, name: m.name, pricing: m.pricing })));
  
  const gpt4 = openaiProvider.createLLM('gpt-4o-mini');
  
  // Non-streaming chat
  const result = await gpt4.chat('What is the capital of France?', {
    temperature: 0.7,
    maxTokens: 100,
    system: 'You are a helpful geography assistant'
  });
  
  console.log('Response:', result.parsed.content);
  console.log('Usage:', result.usage);
  
  // Streaming chat
  console.log('\n=== Streaming Example ===');
  const streamResult = await gpt4.chat('Tell me a short story about a robot', {
    temperature: 1.0,
    maxTokens: 200
  }, (chunk) => {
    process.stdout.write(chunk);
  });
  
  console.log('\n\nCode blocks found:', streamResult.parsed.codeBlocks);

  // Example 2: Using Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('\n=== Anthropic Example ===');
    const anthropicProvider = MultiLLM.createProvider('anthropic', process.env.ANTHROPIC_API_KEY);
    const claude = anthropicProvider.createLLM('claude-3-5-sonnet-20241022');
    
    const claudeResult = await claude.chat('Write a simple Python function to calculate fibonacci numbers', {
      temperature: 0.3,
      maxTokens: 300
    });
    
    console.log('Claude response:', claudeResult.parsed.content);
    if (claudeResult.parsed.codeBlocks.length > 0) {
      console.log('Generated code:');
      claudeResult.parsed.codeBlocks.forEach(block => {
        console.log(`Language: ${block.language}`);
        console.log(block.code);
      });
    }
  }

  // Example 3: Using Ollama (local)
  try {
    console.log('\n=== Ollama Example (if running locally) ===');
    const ollamaProvider = MultiLLM.createProvider('ollama', '', 'http://localhost:11434');
    const ollamaModels = await ollamaProvider.getModels();
    
    if (ollamaModels.length > 0) {
      console.log('Ollama models:', ollamaModels.map(m => m.id));
      
      const llama = ollamaProvider.createLLM(ollamaModels[0].id);
      const ollamaResult = await llama.chat('Hello!', { temperature: 0.8 });
      console.log('Ollama response:', ollamaResult.parsed.content);
    }
  } catch (error) {
    console.log('Ollama not available (this is expected if not running locally)');
  }

  // Example 4: MCP Integration (placeholder)
  console.log('\n=== MCP Example ===');
  const mcpLLM = openaiProvider.createLLM('gpt-4o-mini');
  // mcpLLM.addMCP('python3 -m my_mcp_server');
  console.log('MCP integration ready (use addMCP to connect tools)');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };