import { createPinoLogger, type LogLevelName } from "@surya/core/logger";
import Pino from "pino";

const level = (process.env.LOG_LEVEL || "warn") as LogLevelName;
/**
 * Shared logger instance
 */
export const logger = createPinoLogger(Pino, {
	pinoOptions: {
		base: undefined,
		level,
	},
	level,
	name: "surya-rb",
	disableTimestamp: true,
});
