import { readEnv } from "@surya/core/read-env";
import createClient from "openapi-fetch";
import type { paths } from "../types/itsrose-schema";
import { logger } from "./logger";

/**
 * fetch client instance.
 * Used to make HTTP requests to itsrose API
 */
export const fetchClient = createClient<paths>({
	baseUrl: readEnv("SR_ITSROSE_API_URL", { required: true }),
	headers: {
		"Content-Type": "application/json",
		Accept: "application/json",
		authorization:
			"Bearer " + readEnv("SR_ITSROSE_API_KEY", { required: true }),
	},
});

fetchClient.use({
	onRequest({ request }) {
		logger.trace(`[fetch] ${request.method} ${request.url}`);
		return request;
	},
	onResponse({ response }) {
		logger.trace(`[fetch] ${response.status} ${response.url}`);
		return response;
	},
});
