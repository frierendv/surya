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

	const user = db.users.set(sender);
	user.name = ctx.name;

	if (user.premium && user.premium_expired < Date.now()) {
		user.premium = false;
		user.premium_expired = 0;
	}

	const settings = db.settings.set(sock.user?.id ?? "");
	if (shouldSkipMessage(settings, isGroup)) {
		logger.info("Skipping message");
		return;
	}

	if (isGroup && groupMetadata) {
		const group = db.groups.set(ctx.from);
		if (group.banned && !isOwner) {
			return;
		}
		group.name = groupMetadata.subject;
	}
	wrap(() => sock.readMessages([ctx.message.key]), logger.error);
	Object.assign(ctx, { groupMetadata, isOwner, isAdmin, isBotAdmin });
	await next();
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
