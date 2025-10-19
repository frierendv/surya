import { messageHandler } from "@/handler/message";
import { pluginHandler } from "@/handler/plugin";
import { useAuthProvider } from "@/libs/auth-provider";
import db from "@/libs/database";
import { baileysLogger, logger } from "@/libs/logger";
import {
	BaileysSocket,
	type CreateBaileysOptions,
	type WASocket,
} from "@surya/baileys-utils";
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
import type {
	ConnectionState,
	GroupMetadata,
	GroupParticipant,
	MessageUpsertType,
	WAMessage,
} from "baileys";
import { LRUCache } from "lru-cache";
import { requestPairing } from "./pairing";
import { proxyBind } from "./proxy";

const shouldIgnoreJid = (jid: string) =>
	isJidBroadcast(jid) ||
	isJidStatusBroadcast(jid) ||
	isJidMetaAI(jid) ||
	isJidNewsletter(jid);

let _socket: WASocket = Object.create(null);
/**
 * Used for external access to the Baileys socket
 */
const socket: WASocket = new Proxy(Object.create(null), {
	get(_t, prop: keyof WASocket) {
		const v = _socket[prop];
		if (typeof v === "function") {
			return v.bind(_socket);
		}
		if (v && typeof v === "object") {
			return proxyBind(v);
		}
		return v;
	},
});

const _cacheGroupMetadata = new LRUCache<string, GroupMetadata>({
	// 5 minutes
	ttl: 1000 * 60 * 5,
	max: 1000,
});
const cachedGroupMetadata = {
	get: async (id: string): Promise<GroupMetadata | undefined> => {
		const cached = _cacheGroupMetadata.get(id);
		if (cached) {
			return cached;
		}
		await using group = await db.groups.get(id);
		if (group.metadata) {
			_cacheGroupMetadata.set(id, group.metadata);
		}
		return group.metadata;
	},
	set: (id: string, metadata: GroupMetadata) => {
		_cacheGroupMetadata.set(id, metadata);
	},
	refresh: (() => {
		const inflight = new Map<string, Promise<GroupMetadata>>();
		return async (id: string): Promise<GroupMetadata> => {
			const existing = inflight.get(id);
			if (existing) {
				return existing;
			}

			const p = (async (): Promise<GroupMetadata> => {
				await using group = await db.groups.get(id);
				const fetchLive = async (): Promise<
					GroupMetadata | undefined
				> => {
					try {
						if (!socket?.groupMetadata) {
							return undefined;
						}
						const meta = await socket.groupMetadata(id);
						group.metadata = meta;
						_cacheGroupMetadata.set(id, group.metadata);
						return meta;
					} catch (err) {
						logger.debug(
							{ err, id },
							"cachedGroupMetadata.refresh live fetch failed"
						);
						return undefined;
					}
				};

				const live = await fetchLive();
				if (live) {
					return live;
				}
				if (group?.metadata) {
					_cacheGroupMetadata.set(id, group.metadata);
				}

				return group.metadata;
			})();
			inflight.set(id, p);
			try {
				return await p;
			} finally {
				inflight.delete(id);
			}
		};
	})(),
};

const createSocket = (over?: Partial<CreateBaileysOptions>) => {
	const client = new BaileysSocket({
		authProvider: useAuthProvider(),
		socketConfig: {
			logger: baileysLogger,
			shouldIgnoreJid,
			browser: Browsers.windows("Desktop"),
			syncFullHistory: true,
			cachedGroupMetadata: cachedGroupMetadata.get,
			...over?.socketConfig,
		},
		maxReconnectAttempts: 10,
		initialReconnectDelayMs: 3000,
		...over,
	});

	const handleConnectionUpdate = async (update: Partial<ConnectionState>) => {
		if (update.qr) {
			await requestPairing(update.qr, client.socket);
		}

		if (update.connection === "open" && client.socket) {
			if (client.socket.user) {
				// normalize id and lid
				const [id, lid] = [
					jidNormalizedUser(client.socket.user.id),
					jidNormalizedUser(client.socket.user.lid),
				];
				Object.assign(client.socket.user, {
					id,
					lid,
				});
				logger.success({ ...client.socket.user }, "Baileys connected");
			}

			if (!(client.socket as any).sendFile) {
				attachSendFile(client.socket);
				logger.info("Patched in sendFile to Baileys socket");
			}
			_socket = proxyBind(client.socket);
		}
	};

	const handleMessageUpsert = async (upsert: {
		messages: WAMessage[];
		type: MessageUpsertType;
	}) => {
		if (upsert.type !== "notify") {
			return;
		}
		const message = upsert.messages?.[0] as Required<WAMessage> | undefined;
		if (!message) {
			return;
		}

		const remoteJid = message.key?.remoteJid;
		if (!remoteJid || shouldIgnoreJid(remoteJid)) {
			return;
		}

		try {
			const result = await messageHandler(message);
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
	const handleGroupUpdate = async ([update]: Partial<GroupMetadata>[]) => {
		if (!update?.id) {
			return;
		}
		try {
			await cachedGroupMetadata.refresh(update.id);
		} catch (err) {
			logger.debug(
				{ err, id: update.id },
				"handleGroupUpdate refresh failed"
			);
		}
	};

	client.on("connection.update", handleConnectionUpdate);
	client.on("messages.upsert", handleMessageUpsert);
	client.on("groups.update", handleGroupUpdate);
	client.on("group-participants.update", (update) =>
		handleGroupUpdate([update as GroupParticipant])
	);
	client.on("call", async (calls) => {
		const call = calls[0];
		if (!call) {
			return;
		}

		if (readEnv("NODE_ENV") === "production") {
			logger.warn({ call }, "Incoming call received - rejecting");
			await socket.rejectCall(call.id, call.from);
			return;
		}
	});

	return client;
};

export { createSocket, socket, cachedGroupMetadata };
