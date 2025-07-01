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
		dirName =
			messages[0].content[0].text
				.replace(/[^a-zA-Z0-9-_]/g, "_")
				.replaceAll("task", "")
				.replace(/^_+|_+$/g, "")
				.substring(0, 1024) || "unknown"
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
