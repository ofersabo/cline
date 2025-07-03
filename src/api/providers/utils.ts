import fs from "fs"
import path from "path"

/**
 * Writes a log of model messages to a file in a sanitized directory based on the first message content.
 * @param {any[]} messages - The messages array (for directory naming)
 * @param {any[]} allMessages - The full messages to log
 * @param {string} modelName - The model name (used in the log file name)
 */
export function writeModelLog(messages: any[], allMessages: any[], modelName: string) {
	// Sanitize directory name from first message content
	let dirName = "unknown"
	if (messages && messages.length > 0 && messages[0].content[0].text) {
		const text = messages[0].content[0].text
		// Extract content between <task> and </task> tags
		const taskMatch = text.match(/<task>(.*?)<\/task>/s)
		if (taskMatch && taskMatch[1]) {
			dirName =
				taskMatch[1]
					.trim()
					.replace(/\s+/g, "_") // Replace spaces with underscores
					.substring(0, 100) || "unknown" // Trim to 100 characters
		}
	}
	const logsBase = "/Users/ofersabo/code/cline/logs"
	const logDir = path.join(logsBase, dirName)
	const logFile = path.join(logDir, `${modelName}-messages-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
	try {
		fs.mkdirSync(logDir, { recursive: true })
		fs.writeFileSync(logFile, JSON.stringify(allMessages, null, 2), "utf-8")
	} catch (e) {
		console.error("Failed to write model log:", e)
	}
}
