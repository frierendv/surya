import { logger } from "@/libs/logger";
import { measureExecution, performance } from "@/libs/performance";
import pm from "@/libs/plugin-manager";
import {
	createExtraMessageContext,
	createMessageContext,
} from "@surya/baileys-utils";
import type { WASocket } from "@surya/baileys-utils/internals/types";
import { readEnv } from "@surya/core/read-env";
import { jidNormalizedUser, type WAMessage } from "baileys";

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
const owners = getOwnerPL(readEnv("SR_OWNER_NUMBER", { defaultValue: "" }));
const SR_OWNER_SET = new Set<string>([
	...owners.map((num) => `${num}@s.whatsapp.net`),
	...owners.map((num) => `${num}@lid`),
]);

export const messageHandler = async (msg: WAMessage, socket: WASocket) => {
	if (!msg.message) {
		return;
	}
	performance.start("messageHandler");

	const ctx = createMessageContext(msg, socket);

	const { result: extra, performance: extraPerf } = await measureExecution(
		() => createExtraMessageContext(ctx, socket, SR_PREFIXES),
		"createExtraMessageContext"
	);
	logger.debug(
		{ msg: msg.key.id, ...extraPerf },
		"Created extra message context"
	);

	if (!extra || !extra.command) {
		logger.debug({ msg: msg.key.id }, "No command found in message");
		return;
	}

	const candidates = pm.findByCommand(extra.command);
	if (!candidates || candidates.length === 0) {
		logger.debug({ cmd: extra.command }, "No plugin found for command");
		return;
	}

	// Map any LID JIDs to PN in one deduplicated, parallel pass
	const { getPNForLID } = extra.sock.signalRepository.lidMapping;
	const lidSuffix = "@lid";

	type Field = {
		label: "participant" | "sender" | "from";
		get: () => string | undefined;
		set: (v: string) => void;
	};

	const fields: Field[] = [
		{
			label: "participant",
			get: () => ctx.quoted?.participant,
			set: (v) => {
				if (ctx.quoted) {
					ctx.quoted.participant = v;
				}
			},
		},
		{
			label: "sender",
			get: () => ctx.sender,
			set: (v) => {
				ctx.sender = v;
			},
		},
		{
			label: "from",
			get: () => ctx.from,
			set: (v) => {
				ctx.from = v;
			},
		},
	];

	// Collect unique LIDs
	const lids = new Set<string>();
	for (const f of fields) {
		const v = f.get();
		if (v && v.endsWith(lidSuffix)) {
			lids.add(v);
		}
	}

	if (lids.size) {
		const unique = [...lids];
		// Resolve all LIDs in parallel
		const pns = await Promise.all(unique.map((lid) => getPNForLID(lid)));
		// Precompute normalized JIDs
		const normalized = new Map<string, string>();
		for (const [i, lid] of unique.entries()) {
			const pn = pns[i];
			if (pn) {
				normalized.set(lid, jidNormalizedUser(pn));
			}
		}

		// Apply results and log
		for (const f of fields) {
			const original = f.get();
			if (!original || !original.endsWith(lidSuffix)) {
				continue;
			}
			const normalizedJid = normalized.get(original);
			if (!normalizedJid) {
				continue;
			}
			f.set(normalizedJid);
			logger.debug(
				{ [f.label]: original, pn: pns[unique.indexOf(original)] },
				`Mapped ${f.label} LID to PN`
			);
		}
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

	const perf = performance.stop("messageHandler");
	logger.info(
		{
			msg: msg.key.id,
			cmd: extra.command,
			plugins: matches.length,
			...perf,
		},
		"Matched command to plugins"
	);

	return { matches, ctx, extra };
};
