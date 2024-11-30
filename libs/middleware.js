import config from "../config.js";
import { logger } from "../shared/logger.js";
import wrap from "../shared/wrap.js";
import db from "./database.js";
import { extractPermission } from "./feature-handler/parse.js";

/**
 *
 * @type {import("@frierendv/frieren").Baileys.Middleware}
 */
export async function middleware(ctx, next) {
	const { sock, sender, isGroup } = ctx;

	const { groupMetadata, isOwner, isAdmin, isBotAdmin } =
		await extractPermission(ctx, sock, config);

	handleUser(ctx, sender);
	handleSettings(ctx, sock, isGroup);

	if (isGroup && groupMetadata) {
		handleGroup(ctx, groupMetadata, isOwner);
	}

	wrap(() => sock.readMessages([ctx.message.key]), logger.error);
	Object.assign(ctx, { groupMetadata, isOwner, isAdmin, isBotAdmin });
	await next();
}

/**
 * @param {import("@frierendv/frieren/dist/baileys/types.js").IContextMessage} ctx
 * @param {string} sender
 */
function handleUser(ctx, sender) {
	const user = db.users.set(sender);
	user.name = ctx.name;

	if (user.premium && user.premium_expired < Date.now()) {
		user.premium = false;
		user.premium_expired = 0;
	}
}

/**
 * @param {import("@frierendv/frieren/dist/baileys/types.js").IContextMessage} ctx
 * @param {import("@frierendv/frieren/dist/baileys/types.js").WASocketType} sock
 * @param {boolean} isGroup
 */
function handleSettings(ctx, sock, isGroup) {
	const settings = db.settings.set(sock.user?.id ?? "");
	if (shouldSkipMessage(settings, isGroup)) {
		logger.info("Skipping message");
		return;
	}
}

/**
 * @param {import("@frierendv/frieren/dist/baileys/types.js").IContextMessage} ctx
 * @param {import("baileys").GroupMetadata} groupMetadata
 * @param {boolean} isOwner
 */
function handleGroup(ctx, groupMetadata, isOwner) {
	const group = db.groups.set(ctx.from);
	if (group.banned && !isOwner) {
		return;
	}
	group.name = groupMetadata.subject;
}

/**
 * @param {Record<string, any>} settings
 * @param {boolean} isGroup
 * @returns {boolean}
 */
function shouldSkipMessage(settings, isGroup) {
	return (
		(settings.self && isGroup) ||
		(settings.groupOnly && !isGroup) ||
		(settings.privateChatOnly && isGroup)
	);
}
