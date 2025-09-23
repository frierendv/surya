import createClient from "openapi-fetch";
import type { paths } from "../types/itsrose-schema";
import { logger } from "./logger";

if (!process.env.SR_ITSROSE_API_URL) {
	throw new Error(
		"SR_ITSROSE_API_URL is not defined in environment variables"
	);
}
/**
 * fetch client instance.
 * Used to make HTTP requests to itsrose API
 */
export const fetchClient = createClient<paths>({
	baseUrl: process.env.SR_ITSROSE_API_URL,
	headers: {
		"Content-Type": "application/json",
		Accept: "application/json",
		authorization: `Bearer ${process.env.SR_ITSROSE_API_KEY}`,
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
