import { Anthropic } from '@anthropic-ai/sdk';
import { AnthropicHandler } from './src/api/providers/anthropic';
import fs from 'fs/promises';
import path from 'path';
import { ApiConfiguration } from './src/shared/api';

async function testAnthropicPromptLogging() {
  console.log('Testing Anthropic prompt logging...');
  
  // Create a simple handler with test options
  const options: ApiConfiguration = {
    apiKey: process.env.ANTHROPIC_API_KEY || 'dummy-key-for-testing',
    apiModelId: 'claude-3-haiku-20240307',
    apiProvider: 'anthropic'
  };
  
  const handler = new AnthropicHandler(options);
  
  // Create a simple system prompt and messages
  const systemPrompt = 'You are a helpful assistant.';
  const messages: Anthropic.Messages.MessageParam[] = [
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
      console.log('API request failed as expected with dummy key:', error instanceof Error ? error.message : String(error));
    }
    
    // Check if logs directory exists and contains our file
    console.log('Checking logs directory...');
    const logsDir = path.join(process.cwd(), 'logs');
    
    try {
      const files = await fs.readdir(logsDir);
      
      const promptFiles = files.filter(file => file.startsWith('anthropic-prompt-'));
      if (promptFiles.length > 0) {
        console.log('Success! Found prompt files:', promptFiles);
        
        // Read the latest file
        const latestFile = promptFiles.sort().pop();
        if (latestFile) {
          const content = await fs.readFile(path.join(logsDir, latestFile), 'utf8');
          console.log('Latest prompt file content:');
          console.log(content);
        }
      } else {
        console.log('No prompt files found in logs directory.');
      }
    } catch (error) {
      console.error('Error reading logs directory:', error instanceof Error ? error.message : String(error));
    }
  } catch (error) {
    console.error('Test failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run the test
testAnthropicPromptLogging();
