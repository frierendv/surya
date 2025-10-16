import { messageHandler } from "@/handler/message";
import { pluginHandler } from "@/handler/plugin";
import { useAuthProvider } from "@/libs/auth-provider";
import { baileysLogger, logger } from "@/libs/logger";
import {
	BaileysSocket,
	type CreateBaileysOptions,
	type WASocket,
} from "@surya/baileys-utils";
import { attachSendFile } from "@surya/baileys-utils/internals/send-file";
import {
	Browsers,
	isJidBroadcast,
	isJidMetaAI,
	isJidNewsletter,
	isJidStatusBroadcast,
	jidNormalizedUser,
} from "baileys";
import type { ConnectionState, MessageUpsertType, WAMessage } from "baileys";
import { requestPairing } from "./pairing";

const shouldIgnoreJid = (jid: string) =>
	isJidBroadcast(jid) ||
	isJidStatusBroadcast(jid) ||
	isJidMetaAI(jid) ||
	isJidNewsletter(jid);

type InternalWASocket = Pick<WASocket, "sendMessage" | "sendFile">;
/**
 * Used for external access to the Baileys socket
 */
export const socket: InternalWASocket = {} as InternalWASocket;

export const createSocket = (over?: Partial<CreateBaileysOptions>) => {
	const baileys = new BaileysSocket({
		authProvider: useAuthProvider(),
		socketConfig: {
			logger: baileysLogger,
			shouldIgnoreJid,
			browser: Browsers.ubuntu("Edge"),
			...over?.socketConfig,
		},
		maxReconnectAttempts: 10,
		initialReconnectDelayMs: 3000,
		...over,
	});
	const handleConnectionUpdate = async (update: Partial<ConnectionState>) => {
		if (update.qr) {
			await requestPairing(update.qr, baileys.socket);
		}

		if (update.connection === "open" && baileys.socket) {
			const user = baileys.socket.user;
			if (user && (!("phoneNumber" in user) || !user.phoneNumber)) {
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
			if (user) {
				logger.success(
					{ name: user.name, id: user.phoneNumber },
					"Baileys connected"
				);
			}

			if (!(baileys.socket as any).sendFile) {
				attachSendFile(baileys.socket);
				logger.info("Patched in sendFile to Baileys socket");
				const methods = ["sendMessage", "sendFile"] as const;
				for (const method of methods) {
					Object.defineProperty(socket, method, {
						get: () => baileys.socket![method].bind(baileys.socket),
					});
					logger.info(`Patched in ${method} to socket export`);
				}
			}
		}
	};

	const handleMessageUpsert = async ({
		messages,
		type,
	}: {
		messages: WAMessage[];
		type: MessageUpsertType;
	}) => {
		if (type !== "notify" || !messages[0]) {
			return;
		}
		// test
		if (!messages[0]?.key.fromMe) {
			return;
		}

		try {
			const result = await messageHandler(messages[0], baileys.socket!);
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
	};

	baileys.on("connection.update", handleConnectionUpdate);
	baileys.on("messages.upsert", handleMessageUpsert);

	return baileys;
};
