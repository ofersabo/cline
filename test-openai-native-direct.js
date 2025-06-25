// Simple standalone test script for OpenAI Native prompt logging

const fs = require('fs').promises;
const path = require('path');

// Extract a clean directory name from the first message content
function getSubdirectoryNameFromMessages(messages) {
  if (messages.length === 0) {
    return 'unknown-query';
  }
  
  const firstMessage = messages[0];
  let content = firstMessage.content;
  
  // Extract content between <task> tags if present
  const taskMatch = content.match(/<task>\s*([\s\S]*?)\s*<\/task>/);
  if (taskMatch && taskMatch[1]) {
    content = taskMatch[1];
  }

  // Remove all spaces and replace them with underscores
  return content
    .trim()
    .replace(/\s+/g, '_') // Replace spaces (including newlines) with underscores
    || 'unknown-query';
}

// Convert Anthropic-style messages to OpenAI format
function convertToOpenAiMessages(messages) {
  return messages.map(msg => {
    return {
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    };
  });
}

// Create logs directory if it doesn't exist
async function ensureLogsDirectory(subdirName) {
  const baseLogsDir = '/Users/ofersabo/code/cline/logs';
  try {
    await fs.mkdir(baseLogsDir, { recursive: true });
  } catch (err) {
    // Directory might already exist, that's fine
  }
  
  const logsDir = path.join(baseLogsDir, subdirName);
  try {
    await fs.mkdir(logsDir, { recursive: true });
  } catch (err) {
    // Subdirectory might already exist, that's fine
  }
  
  return logsDir;
}

// Write prompt to file
async function writePromptToFile(systemPrompt, messages, modelId) {
  try {
    // Create a subdirectory based on the first message content
    const subdirName = getSubdirectoryNameFromMessages(messages);
    const logsDir = await ensureLogsDirectory(subdirName);
    
    // Create a timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(logsDir, `openai-native-prompt-${timestamp}.json`);
    
    // Format the data
    const data = {
      timestamp: new Date().toISOString(),
      model: modelId,
      systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      openaiMessages: [
        { role: "system", content: systemPrompt }, 
        ...convertToOpenAiMessages(messages)
      ]
    };
    
    // Write to file
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    
    console.log(`OpenAI Native prompt written to: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Failed to write OpenAI Native prompt to file: ${error.message}`);
    throw error;
  }
}

async function testOpenAiNativePromptLogging() {
  console.log('Testing OpenAI Native prompt logging...');
  
  // Test case 1: Simple message
  console.log('\nTest Case 1: Simple message');
  const systemPrompt1 = 'You are a helpful assistant.';
  const messages1 = [
    { role: 'user', content: 'Write a function to calculate Fibonacci numbers' }
  ];
  const modelId = 'gpt-4.1';
  
  try {
    // Write the prompt to a file
    const filePath1 = await writePromptToFile(systemPrompt1, messages1, modelId);
    
    // Read the file back to verify
    const content1 = await fs.readFile(filePath1, 'utf8');
    console.log('File content:');
    console.log(content1);
    
    console.log('Subdirectory name:', getSubdirectoryNameFromMessages(messages1));
    
    // Test case 2: Message with task tag
    console.log('\nTest Case 2: Message with task tag');
    const systemPrompt2 = 'You are a helpful assistant.';
    const messages2 = [
      { role: 'user', content: '<task>\nImplement a React component\n</task>' }
    ];
    
    // Write the prompt to a file
    const filePath2 = await writePromptToFile(systemPrompt2, messages2, modelId);
    
    // Read the file back to verify
    const content2 = await fs.readFile(filePath2, 'utf8');
    console.log('File content:');
    console.log(content2);
    
    console.log('Subdirectory name:', getSubdirectoryNameFromMessages(messages2));
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testOpenAiNativePromptLogging();
