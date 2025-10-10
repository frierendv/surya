import { logger } from "@libs/logger";
import pm from "@libs/plugin-manager";
import {
	createExtraMessageContext,
	createMessageContext,
} from "@surya/baileys-utils";
import type { WASocket } from "@surya/baileys-utils/internals/types";
import type { WAMessage } from "baileys";

const NON_DIGITS_RE = /[^0-9]/g;
const WS_SPLIT_RE = /\s+/;

const rawPrefixes = process.env.SR_PREFIXES || "";
const SR_PREFIXES: string[] = rawPrefixes
	? rawPrefixes.includes(",")
		? rawPrefixes
				.split(",")
				.map((p) => p.trim())
				.filter(Boolean)
		: rawPrefixes.split("").filter(Boolean)
	: [];

const getOwnerPL = (num: string) => {
	if (!num) {
		return [];
	}
	return num
		.split(",")
		.map((o) => o.replace(NON_DIGITS_RE, ""))
		.filter(Boolean);
};

// Precompute owner set once
const owners = getOwnerPL(process.env.SR_OWNER_NUMBER || "");
const SR_OWNER_SET = new Set<string>([
	...owners.map((num) => `${num}@s.whatsapp.net`),
	...owners.map((num) => `${num}@lid`),
]);

export const messageHandler = async (msg: WAMessage, socket: WASocket) => {
	if (!msg.message) {
		return;
	}

	const ctx = createMessageContext(msg, socket);
	const extra = await createExtraMessageContext(ctx, socket, SR_PREFIXES);

	if (!extra || !extra.command) {
		logger.debug({ msg: msg.key.id }, "No command found in message");
		return;
	}

	const candidates = pm.findByCommand(extra.command);
	if (!candidates || candidates.length === 0) {
		logger.debug({ cmd: extra.command }, "No plugin found for command");
		return;
	}

	// Fast flags
	const isOwner = SR_OWNER_SET.has(ctx.sender);
	const isAdmin = !!extra.isAdmin;
	const isGroup = !!extra.isGroup;
	const usedPrefix = !!extra.usedPrefix;

	// Write back once so downstream consumers don't recompute
	extra.isOwner = isOwner;

	// Single-pass filter (no extra closures, no redundant includes checks)
	const matches = [];
	for (const plugin of candidates) {
		if (!plugin.ignorePrefix && !usedPrefix) {
			continue;
		}
		if (plugin.ownerOnly && !isOwner) {
			continue;
		}
		if (plugin.adminOnly && !isAdmin) {
			continue;
		}
		if (plugin.privateChatOnly && isGroup) {
			continue;
		}
		if (plugin.groupChatOnly && !isGroup) {
			continue;
		}
		matches.push(plugin);
	}

	if (matches.length === 0) {
		logger.debug(
			{ cmd: extra.command },
			"No matching plugin found for command"
		);
		return;
	}

	// Reassign text and args without prefix and command
	const usedPrefixLength = extra.usedPrefix ? extra.usedPrefix.length : 0;
	const offset = usedPrefixLength + extra.command.length;
	const rawText = ctx.text || "";
	const sliced = rawText.slice(offset).trim();
	ctx.text = sliced;
	ctx.args = sliced ? sliced.split(WS_SPLIT_RE) : [];

	return { matches, ctx, extra };
};
