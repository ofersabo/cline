import { Anthropic } from "@anthropic-ai/sdk"
import { AnthropicHandler } from "../api/providers/anthropic"
import { Logger } from "../services/logging/Logger"
import { ApiConfiguration } from "../shared/api"
import * as vscode from "vscode"

// Mock the Logger class since we're not running in VSCode
const mockOutputChannel: vscode.OutputChannel = {
  name: "Mock Output Channel",
  append: (value: string) => console.log(value),
  appendLine: (value: string) => console.log(value),
  clear: () => {},
  show: () => {},
  hide: () => {},
  dispose: () => {},
  replace: () => {},
}

Logger.initialize(mockOutputChannel)

async function testAnthropicPromptLogging() {
  console.log('Testing Anthropic prompt logging...')
  
  // Create a simple handler with test options
  const options: ApiConfiguration = {
    apiKey: process.env.ANTHROPIC_API_KEY || 'dummy-key-for-testing',
    apiModelId: 'claude-3-haiku-20240307',
    apiProvider: 'anthropic'
  }
  
  const handler = new AnthropicHandler(options)
  
  // Create a simple system prompt and messages
  const systemPrompt = 'You are a helpful assistant.'
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: 'Hello, how are you?' }
  ]
  
  try {
    // Make a request (this will likely fail with a dummy key, but the prompt should be logged)
    console.log('Making API request...')
    const stream = handler.createMessage(systemPrompt, messages)
    
    // Try to read the first chunk (will likely fail with dummy key)
    try {
      for await (const chunk of stream) {
        console.log('Received chunk:', chunk)
        break // Just get the first chunk
      }
    } catch (error) {
      console.log('API request failed as expected with dummy key:', error instanceof Error ? error.message : String(error))
    }
    
    console.log('Check the logs directory for the prompt file')
  } catch (error) {
    console.error('Test failed:', error instanceof Error ? error.message : String(error))
  }
}

// Run the test
testAnthropicPromptLogging()
