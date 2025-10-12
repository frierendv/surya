import { messageHandler } from "@handler/message";
import { pluginHandler } from "@handler/plugin";
import { logger, silentLogger } from "@libs/logger";
import mongoose, { connectToDatabase } from "@libs/mongodb";
import pm from "@libs/plugin-manager";
import { BaileysSocket } from "@surya/baileys-utils";
import { attachSendFile } from "@surya/baileys-utils/internals/send-file";
import { useMongoDBAuthState } from "@surya/mongodb-auth-state";
import {
	Browsers,
	isJidBroadcast,
	isJidMetaAI,
	isJidNewsletter,
	isJidStatusBroadcast,
	jidNormalizedUser,
} from "baileys";
import QRCode from "qrcode";

connectToDatabase().catch((err) => {
	logger.error({ err }, "Failed to connect to database");
	process.exit(1);
});

const baileys = new BaileysSocket({
	authProvider: useMongoDBAuthState({
		connection: mongoose.connection,
		collectionName: "whatsapp_auth_state",
		sessionId: "my-session",
	}),
	socketConfig: {
		logger: silentLogger, // disable baileys internal logger
		shouldIgnoreJid: (jid) => {
			return (
				isJidBroadcast(jid) ||
				isJidStatusBroadcast(jid) ||
				isJidMetaAI(jid) ||
				isJidNewsletter(jid)
			);
		},
		browser: Browsers.ubuntu("Edge"),
	},
	maxReconnectAttempts: 10,
	initialReconnectDelayMs: 3000,
});

let pairingRequested = false;
/**
 * If `SR_BOT_NUMBER` is set, request pairing code instead of printing QR code.
 * Delete `auth` related collection in MongoDB to re-trigger pairing request.
 * or encounter error, adjust the `Browser` in `socketConfig`.
 */
const requestPairing = async (qr: string) => {
	if (!baileys.socket || baileys.socket.authState.creds.registered) {
		return;
	}
	if (process.env.SR_BOT_NUMBER && !pairingRequested) {
		const phoneNumber = process.env.SR_BOT_NUMBER.replace(/[^0-9]/g, "");
		const code = await baileys.socket!.requestPairingCode(phoneNumber);
		console.log(`Pairing code: ${code}.`);
		pairingRequested = true;
		return;
	}
	QRCode.toString(qr, { type: "terminal", small: true }, (err, url) => {
		if (err) {
			logger.error({ err }, "Failed to generate QR code");
		} else {
			console.log(url);
		}
	});
};

baileys.on("connection.update", (update) => {
	const { qr } = update;
	if (qr) {
		requestPairing(qr).catch((err) =>
			console.error("Failed to request pairing code:", err)
		);
	}

	if (update.connection === "open") {
		if (!baileys.socket?.user?.phoneNumber) {
			const botId = jidNormalizedUser(baileys.socket?.user?.id);
			Object.defineProperty(baileys.socket?.user, "phoneNumber", {
				value: botId,
				enumerable: true,
			});
			logger.warn(
				{ id: baileys.socket?.user?.id, phoneNumber: botId },
				"Assigning phoneNumber to bot user from ID."
			);
		}
		logger.success(
			{
				name: baileys.socket?.user?.name,
				id: baileys.socket?.user?.phoneNumber,
			},
			"Baileys connected"
		);
	}
});
baileys.on("lid-mapping.update", (update) => {
	logger.info({ update }, "LID mapping updated");
});

baileys.on("messages.upsert", async (upsert) => {
	if (upsert.type === "notify" && upsert.messages[0]) {
		const result = await messageHandler(
			upsert.messages[0],
			baileys.socket!
		);
		if (result) {
			const { matches, ctx, extra } = result;
			// execute all matched plugins
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
		}
	}
});

pm.loadAll().then(() => pm.watch());
baileys
	.launch()
	.then(attachSendFile)
	.catch((err) => {
		logger.error({ err }, "Failed to launch Baileys socket");
		process.exit(1);
	});

process.on("SIGINT", async () => {
	logger.fatal("Caught interrupt signal, shutting down...");
	await baileys.stop();
	process.exit(0);
});
