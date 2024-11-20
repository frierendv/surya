import { logger } from "./logger.js";

/**
 * @param {(() => Promise<void>) | (() => void)} fn
 * @param {(e: Error) => void} [onError]
 * @param {() => void} [onSuccess]
 */
export default async function wrap(fn, onError, onSuccess) {
	try {
		await fn();
		if (onSuccess && typeof onSuccess === "function") {
			onSuccess();
		}
	} catch (e) {
		if (onError && typeof onError === "function") {
			onError(e);
		} else {
			logger.error(e);
		}
	}
}
