import mongoose, { connectToDatabase } from "@libs/mongodb";
import pm from "@libs/plugin-manager";
import {
	BaileysSocket,
	createExtraMessageContext,
	createMessageContext,
} from "@surya/baileys-utils";
import { useMongoDBAuthState } from "@surya/mongodb-auth-state";
import P from "pino";
import QRCode from "qrcode";

const prefix = [".", "!"];
const logger = P({ level: "silent" });

connectToDatabase().catch((err) => {
	console.error("Failed to connect to MongoDB:", err);
	process.exit(1);
});
pm.loadAll().then(() => pm.watch());

const baileys = new BaileysSocket({
	authProvider: useMongoDBAuthState({
		connection: mongoose.connection,
		collectionName: "whatsapp_auth_state",
		sessionId: "my-session",
	}),
	socketConfig: {
		logger,
	},
	maxReconnectAttempts: 10,
	initialReconnectDelayMs: 3000,
});

baileys.on("connection.update", (update) => {
	const { qr } = update;
	if (qr) {
		QRCode.toString(qr, { type: "terminal", small: true }, (err, url) => {
			if (err) {
				console.error("Failed to generate QR code:", err);
			} else {
				console.log(url);
			}
		});
	}
});

baileys.on("messages.upsert", async (upsert) => {
	if (upsert.type === "notify") {
		for (const msg of upsert.messages) {
			const ctx = createMessageContext(msg, baileys.socket!);
			const extra = await createExtraMessageContext(ctx, baileys.socket!);

			if (!extra.command || !prefix.includes(extra.prefix)) {
				return;
			}
			const matches = pm.findByCommand(extra.command);
			if (matches.length === 0) {
				return;
			}
			await Promise.all(
				matches.map((plugin) => pm.handle(plugin, ctx, extra))
			);
		}
	}
});

baileys.launch().catch((err) => {
	console.error("Failed to launch Baileys socket:", err);
	process.exit(1);
});

process.on("SIGINT", async () => {
	console.log("Caught interrupt signal, shutting down...");
	await baileys.stop();
	process.exit(0);
});
