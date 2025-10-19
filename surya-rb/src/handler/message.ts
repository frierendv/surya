import { logger } from "@/libs/logger";
import { performance } from "@/libs/performance";
import pm from "@/libs/plugin-manager";
import { cachedGroupMetadata, socket } from "@/socket";
import {
	createExtraMessageContext,
	createMessageContext,
} from "@surya/baileys-utils";
import type { IExtraMessageContext } from "@surya/baileys-utils";
import { readEnv } from "@surya/core/read-env";
import type { Plugin } from "@surya/plugin-manager";
import type { GroupMetadata, WAMessage } from "baileys";

const NON_DIGITS_RE = /[^0-9]/g;
const WS_SPLIT_RE = /\s+/;

const rawPrefixes = readEnv("SR_PREFIXES", { defaultValue: "!" });
const SR_PREFIXES: string[] = rawPrefixes
	? rawPrefixes.includes(",")
		? rawPrefixes
				.split(",")
				.map((p) => p.trim())
				.filter(Boolean)
		: rawPrefixes.split("").filter(Boolean)
	: [];

const getOwnerPL = (num: string): string[] => {
	if (!num) {
		return [];
	}
	return num
		.split(",")
		.map((o) => o.replace(NON_DIGITS_RE, ""))
		.filter(Boolean);
};

const buildOwnerSet = (ownerNums: string[]): Set<string> => {
	return new Set([
		...ownerNums.map((num) => `${num}@s.whatsapp.net`),
		...ownerNums.map((num) => `${num}@lid`),
	]);
};

const isOwner = (
	senderPN: string | undefined,
	senderLID: string | undefined,
	ownerSet: Set<string>
): boolean => {
	return [
		senderPN ? ownerSet.has(senderPN) : false,
		senderLID ? ownerSet.has(senderLID) : false,
	].some(Boolean);
};

const checkGroupRoles = (
	groupMetadata: GroupMetadata,
	senderId: string,
	botId: string
): { isAdmin: boolean; isBotAdmin: boolean } => {
	let isAdmin = false;
	let isBotAdmin = false;
	const participants = groupMetadata?.participants ?? [];
	for (const p of participants) {
		const pIds = [p.phoneNumber, p.id, p.lid].filter(Boolean);
		if (pIds.includes(senderId)) {
			if (
				p.admin === "admin" ||
				p.admin === "superadmin" ||
				p.admin === null
			) {
				isAdmin = true;
			}
		}
		if (pIds.includes(botId)) {
			if (
				p.admin === "admin" ||
				p.admin === "superadmin" ||
				p.admin === null
			) {
				isBotAdmin = true;
			}
		}
		if (isAdmin && isBotAdmin) {
			break;
		}
	}
	return { isAdmin, isBotAdmin };
};

const filterPlugins = (
	candidates: Plugin[],
	extra: IExtraMessageContext
): Plugin[] => {
	const matches: Plugin[] = [];
	for (const plugin of candidates) {
		if (!plugin.ignorePrefix && !extra.usedPrefix) {
			continue;
		}
		if (plugin.ownerOnly && !extra.isOwner) {
			continue;
		}
		if (plugin.adminOnly && !extra.isAdmin) {
			continue;
		}
		if (plugin.privateChatOnly && extra.isGroup) {
			continue;
		}
		if (plugin.groupChatOnly && !extra.isGroup) {
			continue;
		}
		matches.push(plugin);
	}
	return matches;
};

const SR_OWNER_SET = buildOwnerSet(
	getOwnerPL(readEnv("SR_OWNER_NUMBER", { defaultValue: "" }))
);

export const messageHandler = async (msg: WAMessage) => {
	if (!msg.message) {
		return;
	}
	performance.start("messageHandler");

	const ctx = createMessageContext(msg, socket);
	const extra = createExtraMessageContext(ctx, socket, SR_PREFIXES);
	console.log("Context: ", ctx);
	console.log("Extra: ", extra);
	if (!extra || !extra.command) {
		logger.debug({ msg: msg.key.id }, "No command found in message");
		return;
	}
	const candidates = pm.findByCommand(extra.command);
	if (!candidates || candidates.length === 0) {
		logger.debug({ cmd: extra.command }, "No plugin found for command");
		return;
	}

	// Compute LID/PN and roles
	const { getLIDForPN, getPNForLID } = socket.signalRepository.lidMapping;
	let senderPN: string | undefined = undefined;
	let senderLID: string | undefined = undefined;
	if (ctx.key.addressingMode === "pn") {
		senderPN = ctx.sender;
		const lid = await getLIDForPN(senderPN);
		senderLID = lid === null ? undefined : lid;
	} else if (ctx.key.addressingMode === "lid") {
		senderLID = ctx.sender;
		const pn = await getPNForLID(senderLID);
		senderPN = pn === null ? undefined : pn;
	}
	extra.isOwner = isOwner(senderPN, senderLID, SR_OWNER_SET);
	if (senderLID) {
		ctx.sender = senderLID;
	}

	if (extra.isGroup) {
		let groupMetadata = await cachedGroupMetadata.get(ctx.from);
		if (!groupMetadata) {
			groupMetadata = await cachedGroupMetadata.refresh(ctx.from);
		}
		extra.groupMetadata = groupMetadata;
		const { isAdmin, isBotAdmin } = checkGroupRoles(
			groupMetadata,
			ctx.sender,
			socket.user?.id ?? ""
		);
		extra.isAdmin = isAdmin;
		extra.isBotAdmin = isBotAdmin;
	}

	const matches = filterPlugins(candidates, extra);
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

	const perf = performance.stop("messageHandler");
	logger.info(
		{
			msg: msg.key.id,
			cmd: extra.command,
			plugins: matches.length,
			...perf,
		},
		"Message handled"
	);
	console.log("Final Context: ", { matches, ctx, extra });
	return { matches, ctx, extra };
};
