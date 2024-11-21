import { logger } from "../../shared/logger.js";

/**
 * @param {import("surya").Feature} feature
 * @param {string | null | undefined} command
 * @param {unknown} error
 * @param {(text: string) => void} reply
 */
export const handleFeatureError = (feature, command, error, reply) => {
	if (feature.failed) {
		reply(
			feature.failed
				.replace("%cmd", command ?? "")
				.replace("%error", String(error))
		);
	}
	logger.error(error);
};
