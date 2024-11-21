import config from "../config.js";
import { logger, printer } from "../shared/logger.js";
import wrap from "../shared/wrap.js";
import db from "./database.js";
import { handleFeatureError } from "./handler/error.js";
import * as handlerParse from "./handler/parse.js";
import queue from "./queue.js";

/**
 * @param {import("surya").IClientSocket} client
 * @param {import("@frierendv/frieren").Baileys.IParsedMessage} msg
 * @param {import("@frierendv/frieren").Api.Client} api
 * @param {import("./feature-loader").default["features"]} features
 */
export default async function handler(client, msg, api, features) {
	const { sock, store } = client;

	const { groupMetadata, isOwner, isAdmin, isBotAdmin } =
		await handlerParse.extractPermission(msg, sock, config);

	const { sender, reply, text: params, isGroup } = msg;

	const user = db.users.set(sender);
	user.name = msg.name;

	if (user.banned && !isOwner) {
		return;
	}
	if (user.premium && user.premium_expired < Date.now()) {
		user.premium = false;
		user.premium_expired = 0;
	}

	const settings = db.settings.set(sock.user.id);
	if (shouldSkipMessage(settings, isGroup)) {
		logger.info("Skipping message");
		return;
	}

	if (isGroup && groupMetadata) {
		const group = db.groups.set(msg.from);
		if (group.banned && !isOwner) {
			return;
		}
		group.name = groupMetadata.subject;
	}

	// read message
	wrap(() => sock.readMessages([msg.message.key]), logger.error);

	let executed_feature;
	for (const feature of Object.values(features)) {
		const isCommand = [
			...config.prefix,
			...(feature.customPrefix ?? []),
		].some((p) => params?.startsWith(p));

		const _prefix = Array.isArray(config.prefix)
			? config.prefix
			: [config.prefix];

		const { command, text, args, prefix } = handlerParse.extractCommand(
			isCommand,
			params,
			_prefix
		);
		const extras = {
			text,
			args,
			prefix,
			command,
			isGroup,
			isAdmin,
			isOwner,
			isBotAdmin,
			groupMetadata,
			api,
			sock,
			store,
			db,
			features,
			feature,
		};

		if (feature.before && typeof feature.before === "function") {
			await wrap(
				() => feature.before(msg, extras),
				(error) => handleFeatureError(feature, command, error, reply),
				() => {}
			);
		}

		const shouldExecute =
			isCommand &&
			[...feature.command, ...(feature.customPrefix ?? [])].includes(
				command
			);

		if (shouldExecute) {
			if (queue.exist(sender, feature)) {
				reply("You are still using this command");
				continue;
			}
			if (feature.owner && !isOwner) {
				reply("Only the owner can use this command.");
				continue;
			}

			const isAdminCommand = feature.admin && isGroup && !isAdmin;
			if (isAdminCommand) {
				reply("Only the admin can use this command.");
				continue;
			}
			if (feature.group && !isGroup) {
				reply("This command only available in group");
				continue;
			}
			if (feature.private && isGroup) {
				reply("This command only available in private chat");
				continue;
			}

			const shouldApplyLimit = feature.limit && !isOwner && !user.premium;
			if (shouldApplyLimit) {
				if (user.limit < 0) {
					reply("You have reached the limit of using this command");
					continue;
				}
			}

			executed_feature = feature;
			queue.add(sender, executed_feature);
			await wrap(
				() => feature.execute(msg, extras),
				(error) => handleFeatureError(feature, command, error, reply),
				() => {
					if (feature.limit) {
						user.limit--;
					}
				}
			);
		}

		if (feature.after && typeof feature.after === "function") {
			await wrap(
				() => feature.after(msg, extras),
				(error) => handleFeatureError(feature, command, error, reply),
				() => {}
			);
		}
	}
	queue.remove(sender, executed_feature);

	wrap(() => printer(msg, groupMetadata), logger.error);
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
