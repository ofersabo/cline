import { Anthropic } from "@anthropic-ai/sdk"
import { Mistral } from "@mistralai/mistralai"
import { withRetry } from "../retry"
import { ApiHandler } from "../"
import { ApiHandlerOptions, mistralDefaultModelId, MistralModelId, mistralModels, ModelInfo } from "@shared/api"
import { convertToMistralMessages } from "../transform/mistral-format"
import { ApiStream } from "../transform/stream"
import fs from "fs/promises"
import path from "path"

export class MistralHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: Mistral

	constructor(options: ApiHandlerOptions) {
		this.options = options
		this.client = new Mistral({
			apiKey: this.options.mistralApiKey,
		})
	}

	@withRetry()
	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		// Write the prompt to a file for debugging
		await this.writePromptToFile(systemPrompt, messages)
		
		// Also log to console for easier testing
		console.log("OpenAI Native Prompt Logging:")
		console.log("System Prompt:", systemPrompt)
		console.log("Messages:", JSON.stringify(messages, null, 2))

		const stream = await this.client.chat
			.stream({
				model: this.getModel().id,
				// max_completion_tokens: this.getModel().info.maxTokens,
				temperature: 0,
				messages: [{ role: "system", content: systemPrompt }, ...convertToMistralMessages(messages)],
				stream: true,
			})
			.catch((err) => {
				// The Mistal SDK uses statusCode instead of status
				// However, if they introduce status for something, I don't want to override it
				if ("statusCode" in err && !("status" in err)) {
					err.status = err.statusCode
				}

				throw err
			})

		for await (const chunk of stream) {
			const delta = chunk.data.choices[0]?.delta
			if (delta?.content) {
				let content: string = ""
				if (typeof delta.content === "string") {
					content = delta.content
				} else if (Array.isArray(delta.content)) {
					content = delta.content.map((c) => (c.type === "text" ? c.text : "")).join("")
				}
				yield {
					type: "text",
					text: content,
				}
			}

			if (chunk.data.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.data.usage.promptTokens || 0,
					outputTokens: chunk.data.usage.completionTokens || 0,
				}
			}
		}
	}

	getModel(): { id: MistralModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in mistralModels) {
			const id = modelId as MistralModelId
			return { id, info: mistralModels[id] }
		}
		return {
			id: mistralDefaultModelId,
			info: mistralModels[mistralDefaultModelId],
		}
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
			const filePath = path.join(logsDir, `mistral-prompt-${timestamp}.json`)

			// Format the data
			const data = {
				timestamp: new Date().toISOString(),
				model: this.getModel().id,
				systemPrompt,
				messages: messages.map(msg => ({
					role: msg.role,
					content: msg.content
				})),
				mistralMessages: [
					{ role: "system", content: systemPrompt },
					...convertToMistralMessages(messages)
				]
			}

			// Write to file
			await fs.writeFile(filePath, JSON.stringify(data, null, 2))

			console.info(`Mistral prompt written to: ${filePath}`)
		} catch (error) {
			console.error(`Failed to write Mistral prompt to file: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	private getSubdirectoryNameFromMessages(messages: Anthropic.Messages.MessageParam[]): string {
		if (!messages || messages.length === 0) return 'unknown'
		const firstContent = typeof messages[0].content === 'string' ? messages[0].content : JSON.stringify(messages[0].content)
		return firstContent.slice(0, 32).replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown'
	}
}
