const { Anthropic } = require('@anthropic-ai/sdk');
const { AnthropicHandler } = require('./src/api/providers/anthropic');
const fs = require('fs').promises;
const path = require('path');

async function testAnthropicPromptLogging() {
  console.log('Testing Anthropic prompt logging...');
  
  // Create a simple handler with test options
  const handler = new AnthropicHandler({
    apiKey: process.env.ANTHROPIC_API_KEY || 'dummy-key-for-testing',
    apiModelId: 'claude-3-haiku-20240307'
  });
  
  // Create a simple system prompt and messages
  const systemPrompt = 'You are a helpful assistant.';
  const messages = [
    { role: 'user', content: 'Hello, how are you?' }
  ];
  
  try {
    // Make a request (this will likely fail with a dummy key, but the prompt should be logged)
    console.log('Making API request...');
    const stream = handler.createMessage(systemPrompt, messages);
    
    // Try to read the first chunk (will likely fail with dummy key)
    try {
      for await (const chunk of stream) {
        console.log('Received chunk:', chunk);
        break; // Just get the first chunk
      }
    } catch (error) {
      console.log('API request failed as expected with dummy key:', error.message);
    }
    
    // Check if logs directory exists and contains our file
    console.log('Checking logs directory...');
    const logsDir = path.join(process.cwd(), 'logs');
    const files = await fs.readdir(logsDir);
    
    const promptFiles = files.filter(file => file.startsWith('anthropic-prompt-'));
    if (promptFiles.length > 0) {
      console.log('Success! Found prompt files:', promptFiles);
      
      // Read the latest file
      const latestFile = promptFiles.sort().pop();
      const content = await fs.readFile(path.join(logsDir, latestFile), 'utf8');
      console.log('Latest prompt file content:');
      console.log(content);
    } else {
      console.log('No prompt files found in logs directory.');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testAnthropicPromptLogging();
