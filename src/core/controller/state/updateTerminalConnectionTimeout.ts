import { Controller } from "../index"
import * as proto from "@/shared/proto"
import { updateGlobalState } from "../../storage/state"

export async function updateTerminalConnectionTimeout(
	controller: Controller,
	request: proto.cline.Int64Request,
): Promise<proto.cline.Int64> {
	const timeoutValue = request.value

		if (typeof timeout === "number" && !isNaN(timeout) && timeout > 0) {
			// Update the global state directly
			await updateGlobalState(controller.context, "shellIntegrationTimeout", timeout)
			return Int64.create({ value: timeout })
		} else {
			console.warn(`Invalid shell integration timeout value received: ${timeout}. Expected a positive number.`)
			throw new Error("Invalid timeout value. Expected a positive number.")
		}
	} catch (error) {
		console.error(`Failed to update terminal connection timeout: ${error}`)
		throw error
	}
}
