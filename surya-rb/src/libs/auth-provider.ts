import { readEnv } from "@surya/core/read-env";
import type { AuthenticationState } from "baileys";
import mongoose from "mongoose";

let cachedAuthProvider: Promise<{
	state: AuthenticationState;
	saveCreds: () => Promise<void>;
}> | null = null;

export const useAuthProvider = () => {
	if (cachedAuthProvider) {
		return cachedAuthProvider;
	}

	if (mongoose?.connection?.readyState === 1) {
		cachedAuthProvider = (async () => {
			const { useMongoDBAuthState } = await import(
				"@surya/mongodb-auth-state"
			);

			return useMongoDBAuthState({
				connection: mongoose.connection,
				collectionName: "whatsapp_auth_state",
				sessionId: "my-session",
			});
		})();
	} else {
		cachedAuthProvider = (async () => {
			const { useMultiFileAuthState } = await import("baileys");
			const dir = readEnv("SR_AUTH_STATE_DIR", {
				defaultValue: "./auth_state",
			});
			return useMultiFileAuthState(dir);
		})();
	}

	return cachedAuthProvider;
};
