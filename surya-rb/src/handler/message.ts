import { logger } from "@libs/logger";
import pm from "@libs/plugin-manager";
import {
	createExtraMessageContext,
	createMessageContext,
} from "@surya/baileys-utils";
import type { WASocket } from "@surya/baileys-utils/internals/types";
import type { WAMessage } from "baileys";

const rawPrefixes = process.env.SR_PREFIXES || "";
const SR_PREFIXES = rawPrefixes
	? rawPrefixes.includes(",")
		? rawPrefixes
				.split(",")
				.map((p) => p.trim())
				.filter(Boolean)
		: rawPrefixes.split("").filter(Boolean)
	: [];

const getOwnerPL = (num: string) => {
	const cleaned = num
		.split(",")
		.map((o) => o.replace(/[^0-9]/g, ""))
		.filter(Boolean);
	return cleaned;
};
/**
 * Owner numbers set for O(1) lookup. Normalize once at module load.
 */
const SR_OWNER_SET = new Set([
	...getOwnerPL(process.env.SR_OWNER_NUMBER || "").map(
		(num) => `${num}@s.whatsapp.net`
	),
	...getOwnerPL(process.env.SR_OWNER_NUMBER || "").map((num) => `${num}@lid`),
]);

export const messageHandler = async (msg: WAMessage, socket: WASocket) => {
	if (!msg.message) {
		return;
	}
	const ctx = createMessageContext(msg, socket);
	const extra = await createExtraMessageContext(ctx, socket, SR_PREFIXES);

	if (!extra?.command) {
		logger.debug({ msg: msg.key.id }, "No command found in message");
		return;
	}

	// find candidate plugins and run a single filter pass (fewer array iterations)
	const candidates = pm.findByCommand(extra.command);
	if (!candidates?.length) {
		logger.debug({ cmd: extra.command }, "No plugin found for command");
		return;
	}
	// owner lookup using precomputed set (faster than remapping every call)
	extra.isOwner = SR_OWNER_SET.has(ctx.sender);

	const matches = candidates.filter((plugin) => {
		// if plugin ignores prefix and the plugin command includes the given command -> allow
		if (plugin.ignorePrefix && plugin.command.includes(extra.command)) {
			return true;
		}
		// plugin requires prefix but no prefix was used -> reject
		if (!plugin.ignorePrefix && !extra.usedPrefix) {
			return false;
		}
		// owner only
		if (plugin.ownerOnly && !extra.isOwner) {
			return false;
		}
		// admin only
		if (plugin.adminOnly && !extra.isAdmin) {
			return false;
		}
		// private chat only
		if (plugin.privateChatOnly && extra.isGroup) {
			return false;
		}
		// group chat only
		if (plugin.groupChatOnly && !extra.isGroup) {
			return false;
		}
		return true;
	});

	if (!matches.length) {
		logger.debug(
			{ cmd: extra.command },
			"No matching plugin found for command"
		);
		return;
	}

	// reassign text and args without prefix and command
	const usedPrefixLength = (extra.usedPrefix || "").length;
	const offset = usedPrefixLength + extra.command.length;
	ctx.text = (ctx.text || "").slice(offset).trim();
	ctx.args = ctx.text ? ctx.text.split(/\s+/) : [];

	return { matches, ctx, extra };
};
