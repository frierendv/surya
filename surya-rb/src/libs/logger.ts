import { createPinoLogger, type LogLevelName } from "@surya/core/logger";
import { readEnv } from "@surya/core/read-env";
import Pino from "pino";

const level = readEnv("LOG_LEVEL", { defaultValue: "info" }) as LogLevelName;
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

export const silentLogger = Pino({
	level: "silent",
	base: undefined,
});
