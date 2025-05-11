// Simple standalone test script for Anthropic prompt logging

const fs = require('fs').promises;
const path = require('path');

// Create logs directory if it doesn't exist
async function ensureLogsDirectory() {
  const logsDir = path.join(process.cwd(), 'logs');
  try {
    await fs.mkdir(logsDir, { recursive: true });
  } catch (err) {
    // Directory might already exist, that's fine
  }
  return logsDir;
}

// Write prompt to file
async function writePromptToFile(systemPrompt, messages) {
  try {
    const logsDir = await ensureLogsDirectory();
    
    // Create a timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(logsDir, `anthropic-prompt-${timestamp}.json`);
    
    // Format the data
    const data = {
      timestamp: new Date().toISOString(),
      systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    };
    
    // Write to file
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    
    console.log(`Anthropic prompt written to: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Failed to write Anthropic prompt to file: ${error.message}`);
    throw error;
  }
}

async function testAnthropicPromptLogging() {
  console.log('Testing Anthropic prompt logging...');
  
  // Create a simple system prompt and messages
  const systemPrompt = 'You are a helpful assistant.';
  const messages = [
    { role: 'user', content: 'Hello, how are you?' }
  ];
  
  try {
    // Write the prompt to a file
    const filePath = await writePromptToFile(systemPrompt, messages);
    
    // Read the file back to verify
    const content = await fs.readFile(filePath, 'utf8');
    console.log('File content:');
    console.log(content);
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testAnthropicPromptLogging();
