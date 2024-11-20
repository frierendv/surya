import config from "../config.js";
import { logger } from "../shared/logger.js";
import wrap from "../shared/wrap.js";
import db from "./database.js";

/**
 * @param {import("surya").IClientSocket} client
 * @param {import("@frierendv/frieren").Api.Client} api
 * @param {import("@frierendv/frieren").Baileys.IParsedMessage} msg
 * @param {import("./feature-loader").default["features"]} features
 */
export default async function handler(client, api, msg, features) {
	const { sender, reply, text: params, isGroup } = msg;
	const { sock, store } = client;

	const groupMetadata = isGroup ? await sock.groupMetadata(msg.from) : null;

	wrap(() => sock.readMessages([msg.message.key]), logger.error);

	const isOwner = (
		Array.isArray(config.owner) ? config.owner : [config.owner]
	)
		.map((n) => n.replace(/[^\d]/g, "") + "@s.whatsapp.net")
		.includes(sender);
	const isAdmin =
		isGroup && groupMetadata
			? groupMetadata.participants
					.filter((p) => p.admin)
					.map((p) => p.id)
					.includes(sender)
			: false;
	const isBotAdmin =
		isGroup && groupMetadata
			? groupMetadata.participants
					.filter((p) => p.admin)
					.map((p) => p.id)
					.includes(sock.user?.id ?? "")
			: false;

	const user = db.users.set(sender);
	user.name = msg.name;

	if (user.banned && !isOwner) {
		return;
	}
	if (user.premium && user.premium_expired < Date.now()) {
		user.premium = false;
		user.premium_expired = 0;
	}

	try {
		for (const feature of Object.values(features)) {
			const isCommand = [
				...config.prefix,
				...(feature.customPrefix ?? []),
			].some((p) => params?.startsWith(p));
			const text = isCommand
				? params?.slice(1 + params.slice(1).split(" ")[0].length + 1)
				: params;
			const args = text?.split(" ");
			const prefix = config.prefix.find((p) => params?.startsWith(p));
			const command = isCommand ? params?.split(" ")[0].slice(1) : null;

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
			};

			if (feature.before && typeof feature.before === "function") {
				await wrap(
					() => feature.before(msg, extras),
					(error) =>
						handleFeatureError(feature, command, error, reply),
					() => logger.info("Before command executed")
				);
			}

			if (isCommand && feature.command.includes(command)) {
				if (feature.owner && !isOwner) {
					reply("Only the owner can use this command.");
					continue;
				}
				if (feature.admin && isGroup && !isAdmin) {
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
				if (feature.limit && !isOwner && !user.premium) {
					if (user.limit < 0) {
						reply(
							"You have reached the limit of using this command"
						);
						continue;
					}
				}

				await wrap(
					() => feature.execute(msg, extras),
					(error) =>
						handleFeatureError(feature, command, error, reply),
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
					(error) =>
						handleFeatureError(feature, command, error, reply),
					() => logger.info("After command executed")
				);
			}
		}
	} catch (error) {
		logger.error(error);
	}
}

/**
 * @param {{ failed: string; }} feature
 * @param {string | null | undefined} command
 * @param {unknown} error
 * @param {(text: string) => void} reply
 */
function handleFeatureError(feature, command, error, reply) {
	if (feature.failed) {
		reply(
			feature.failed
				.replace("%cmd", command ?? "")
				.replace("%error", String(error))
		);
	}
	logger.error(error);
}
