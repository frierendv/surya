import crypto from "node:crypto";
import type { paths } from "@/types/itsrose-schema";
import { readEnv } from "@surya/core/read-env";
import { createOpenApiFetchClient } from "feature-fetch";

const baseUrl = readEnv("SR_ITSROSE_API_URL", { required: true });
const apiKey = readEnv("SR_ITSROSE_API_KEY", { required: true });
/**
 * fetch client instance.
 * Used to make HTTP requests to itsrose API
 */
const fetchClient = createOpenApiFetchClient<paths>({
	prefixUrl: baseUrl,
	headers: {
		authorization: "Bearer " + apiKey,
	},
});

FormData.prototype._generateBoundary = function () {
	this._boundary = "-".repeat(26) + crypto.randomBytes(12).toString("hex");
};
FormData.prototype.getBoundary = function () {
	if (!this._boundary) {
		this._generateBoundary();
	}

	return this._boundary;
};

export { fetchClient };

declare global {
	interface FormData {
		_boundary: string;
		_generateBoundary(): void;
		getBoundary(): string;
	}
}
