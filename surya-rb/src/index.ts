import { messageHandler } from "@handler/message";
import { pluginHandler } from "@handler/plugin";
import { useAuthProvider } from "@libs/auth-provider";
import { closeDatabase, initDatabase } from "@libs/database";
import { logger, silentLogger } from "@libs/logger";
import { connectToDatabase } from "@libs/mongodb";
import pm from "@libs/plugin-manager";
import { BaileysSocket } from "@surya/baileys-utils";
import { attachSendFile } from "@surya/baileys-utils/internals/send-file";
import { readEnv } from "@surya/core/read-env";
import {
	Browsers,
	isJidBroadcast,
	isJidMetaAI,
	isJidNewsletter,
	isJidStatusBroadcast,
	jidNormalizedUser,
} from "baileys";
import QRCode from "qrcode";

const shouldIgnoreJid = (jid: string) =>
	isJidBroadcast(jid) ||
	isJidStatusBroadcast(jid) ||
	isJidMetaAI(jid) ||
	isJidNewsletter(jid);

const start = async () => {
	try {
		await connectToDatabase();
		logger.success("Connected to MongoDB");
		await initDatabase();
		logger.success("Database initialized");
	} catch (err) {
		logger.error({ err }, "Failed to initialize persistence layer");
		process.exit(1);
	}

	const baileys = new BaileysSocket({
		authProvider: useAuthProvider(),
		socketConfig: {
			logger: silentLogger,
			shouldIgnoreJid,
			browser: Browsers.ubuntu("Edge"),
		},
		maxReconnectAttempts: 10,
		initialReconnectDelayMs: 3000,
	});

	try {
		await pm.load();
		await pm.watch();
	} catch (err) {
		logger.error({ err }, "Plugin manager failed to initialize");
		process.exit(1);
	}

	let pairingRequested = false;
	const envBotNumber = readEnv("SR_BOT_NUMBER");

	const requestPairing = async (qr: string) => {
		const sock = baileys.socket;
		if (!sock || sock.authState.creds.registered) {
			return;
		}

		if (envBotNumber && !pairingRequested) {
			try {
				const phoneNumber = envBotNumber.replace(/\D+/g, "");
				const code = await sock.requestPairingCode(phoneNumber);
				logger.info("Pairing code generated");
				console.log(`Pairing code: ${code}.`);
				pairingRequested = true;
				return;
			} catch (err) {
				logger.error({ err }, "Failed to request pairing code");
				// fallthrough to QR
			}
		}

		try {
			const qrStr = await QRCode.toString(qr, {
				type: "terminal",
				small: true,
			});
			console.log(qrStr);
		} catch (err) {
			logger.error({ err }, "Failed to generate QR code");
		}
	};

	baileys.on("connection.update", (update) => {
		if (update.qr) {
			requestPairing(update.qr).catch((err) =>
				logger.error({ err }, "Failed to handle pairing/QR")
			);
		}

		if (update.connection === "open") {
			const user = baileys.socket?.user;
			if (user) {
				if (!("phoneNumber" in user) || !user.phoneNumber) {
					const botId = jidNormalizedUser(user.id);
					Object.defineProperty(user, "phoneNumber", {
						value: botId,
						enumerable: true,
					});
					logger.warn(
						{ id: user.id, phoneNumber: botId },
						"Assigning phoneNumber to bot user from ID."
					);
				}
				logger.success(
					{ name: user.name, id: user.phoneNumber },
					"Baileys connected"
				);
			}

			// ensure sendFile is available on every new socket instance
			if (baileys.socket && !(baileys.socket as any).sendFile) {
				attachSendFile(baileys.socket);
				logger.info("Patched in sendFile to Baileys socket");
			}
		}
	});

	baileys.on("messages.upsert", async (upsert) => {
		try {
			if (upsert.type !== "notify" || !upsert.messages[0]) {
				return;
			}

			const msg = upsert.messages[0];
			const result = await messageHandler(msg, baileys.socket!);
			if (!result) {
				return;
			}

			const { matches, ctx, extra } = result;
			for (const plugin of matches) {
				try {
					await pluginHandler(plugin, ctx, extra);
				} catch (err) {
					logger.error(
						{ err, plugin: plugin.name },
						"Error executing plugin"
					);
				}
			}
		} catch (err) {
			logger.error({ err }, "messages.upsert handler error");
		}
	});

	try {
		await baileys.launch();
	} catch (err) {
		logger.error({ err }, "Failed to launch Baileys socket");
		process.exit(1);
	}

	const shutdown = async (signal: string) => {
		logger.fatal({ signal }, "Shutting down...");
		try {
			await baileys.stop();
			await closeDatabase();
			await pm.stop();
			logger.info("Shutdown complete");
		} catch (err) {
			logger.error({ err }, "Error during shutdown");
		} finally {
			process.exit(0);
		}
	};

	process.once("SIGINT", () => void shutdown("SIGINT"));
	process.once("SIGTERM", () => void shutdown("SIGTERM"));

	process.on("unhandledRejection", (reason) => {
		logger.fatal({ reason }, "Unhandled promise rejection");
	});
	process.on("uncaughtException", (err) => {
		logger.fatal({ err }, "Uncaught exception");
	});
};

start().catch((err) => {
	logger.fatal({ err }, "Fatal error");
	process.exit(1);
});
