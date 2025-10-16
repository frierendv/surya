import { readEnv } from "@surya/core/read-env";
import type { AuthenticationState } from "baileys";

let cachedAuthProvider: Promise<{
	state: AuthenticationState;
	saveCreds: () => Promise<void>;
}> | null = null;

export const useAuthProvider = () => {
	if (cachedAuthProvider) {
		return cachedAuthProvider;
	}

	const mongoUri = readEnv("SR_MONGODB_URI", { defaultValue: "" });

	if (mongoUri) {
		cachedAuthProvider = (async () => {
			const { default: mongoose, connectToDatabase } = await import(
				"@/libs/mongodb"
			);
			await connectToDatabase();

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
