import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { withRetry } from "../retry"
import { ApiHandler } from "../"
import {
	ApiHandlerOptions,
	ModelInfo,
	openAiNativeDefaultModelId,
	OpenAiNativeModelId,
	openAiNativeModels,
} from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { calculateApiCostOpenAI } from "../../utils/cost"
import { ApiStream } from "../transform/stream"
import type { ChatCompletionReasoningEffort } from "openai/resources/chat/completions"
import fs from "fs/promises"
import * as path from "path"
import { Logger } from "../../services/logging/Logger"

export class OpenAiNativeHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.client = new OpenAI({
			apiKey: this.options.openAiNativeApiKey,
		})
	}

	/**
	 * Extracts a clean directory name from the first message content
	 */
	private getSubdirectoryNameFromMessages(messages: Anthropic.Messages.MessageParam[]): string {
		if (messages.length === 0) {
			return 'unknown-query'
		}
		
		const firstMessage = messages[0]
		let content = ''
		
		if (typeof firstMessage.content === 'string') {
			content = firstMessage.content
		} else if (Array.isArray(firstMessage.content)) {
			// Find the first text block
			const textBlock = firstMessage.content.find(block => block.type === 'text')
			if (textBlock && 'text' in textBlock) {
				content = textBlock.text
			}
		}
		
		// Extract content between <task> tags if present
		const taskMatch = content.match(/<task>\s*([\s\S]*?)\s*<\/task>/)
		if (taskMatch && taskMatch[1]) {
			content = taskMatch[1]
		}
		
		// Clean up the content to make a valid directory name
		return content
			.trim()
			.toLowerCase()
			.replace(/\s+/g, '-') // Replace spaces with hyphens
			.replace(/[^a-z0-9-]/g, '') // Remove special characters
			.replace(/-+/g, '-') // Replace multiple hyphens with a single one
			.substring(0, 50) // Limit length
			|| 'unknown-query'
	}

	/**
	 * Writes the system prompt and messages to a file for debugging purposes
	 */
	private async writePromptToFile(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]) {
		try {
			// Create a logs directory if it doesn't exist
			const baseLogsDir = '/Users/ofersabo/code/cline/logs'
			try {
				await fs.mkdir(baseLogsDir, { recursive: true })
			} catch (err) {
				// Directory might already exist, that's fine
			}
			
			// Create a subdirectory based on the first message content
			const subdirName = this.getSubdirectoryNameFromMessages(messages)
			const logsDir = path.join(baseLogsDir, subdirName)
			
			try {
				await fs.mkdir(logsDir, { recursive: true })
			} catch (err) {
				// Subdirectory might already exist, that's fine
			}
			
			// Create a timestamp for the filename
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
			const filePath = path.join(logsDir, `openai-native-prompt-${timestamp}.json`)
			
			// Format the data
			const data = {
				timestamp: new Date().toISOString(),
				model: this.getModel().id,
				systemPrompt,
				messages: messages.map(msg => ({
					role: msg.role,
					content: msg.content
				})),
				openaiMessages: [
					{ role: "system", content: systemPrompt }, 
					...convertToOpenAiMessages(messages)
				]
			}
			
			// Write to file
			await fs.writeFile(filePath, JSON.stringify(data, null, 2))
			
			Logger.info(`OpenAI Native prompt written to: ${filePath}`)
		} catch (error) {
			Logger.error(`Failed to write OpenAI Native prompt to file: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	private async *yieldUsage(info: ModelInfo, usage: OpenAI.Completions.CompletionUsage | undefined): ApiStream {
		const inputTokens = usage?.prompt_tokens || 0 // sum of cache hits and misses
		const outputTokens = usage?.completion_tokens || 0
		const cacheReadTokens = usage?.prompt_tokens_details?.cached_tokens || 0
		const cacheWriteTokens = 0
		const totalCost = calculateApiCostOpenAI(info, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
		const nonCachedInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens)
		yield {
			type: "usage",
			inputTokens: nonCachedInputTokens,
			outputTokens: outputTokens,
			cacheWriteTokens: cacheWriteTokens,
			cacheReadTokens: cacheReadTokens,
			totalCost: totalCost,
		}
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		// Write the prompt to a file for debugging
		await this.writePromptToFile(systemPrompt, messages)
		
		// Also log to console for easier testing
		console.log("OpenAI Native Prompt Logging:")
		console.log("System Prompt:", systemPrompt)
		console.log("Messages:", JSON.stringify(messages, null, 2))
		const model = this.getModel()

		switch (model.id) {
			case "o1":
			case "o1-preview":
			case "o1-mini": {
				// o1 doesn't support streaming, non-1 temp, or system prompt
				const response = await this.client.chat.completions.create({
					model: model.id,
					messages: [{ role: "user", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
				})
				yield {
					type: "text",
					text: response.choices[0]?.message.content || "",
				}

				yield* this.yieldUsage(model.info, response.usage)

				break
			}
			case "o4-mini":
			case "o3":
			case "o3-mini": {
				const stream = await this.client.chat.completions.create({
					model: model.id,
					messages: [{ role: "developer", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
					stream: true,
					stream_options: { include_usage: true },
					reasoning_effort: (this.options.o3MiniReasoningEffort as ChatCompletionReasoningEffort) || "medium",
				})
				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta
					if (delta?.content) {
						yield {
							type: "text",
							text: delta.content,
						}
					}
					if (chunk.usage) {
						// Only last chunk contains usage
						yield* this.yieldUsage(model.info, chunk.usage)
					}
				}
				break
			}
			default: {
				const stream = await this.client.chat.completions.create({
					model: model.id,
					// max_completion_tokens: this.getModel().info.maxTokens,
					temperature: 0,
					messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
					stream: true,
					stream_options: { include_usage: true },
				})

				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta
					if (delta?.content) {
						yield {
							type: "text",
							text: delta.content,
						}
					}
					if (chunk.usage) {
						// Only last chunk contains usage
						yield* this.yieldUsage(model.info, chunk.usage)
					}
				}
			}
		}
	}

	getModel(): { id: OpenAiNativeModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in openAiNativeModels) {
			const id = modelId as OpenAiNativeModelId
			return { id, info: openAiNativeModels[id] }
		}
		return {
			id: openAiNativeDefaultModelId,
			info: openAiNativeModels[openAiNativeDefaultModelId],
		}
	}
}
