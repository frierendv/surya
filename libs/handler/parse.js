/**
 * @param {import("@frierendv/frieren").Baileys.IParsedMessage} msg
 * @param {import("surya").IClientSocket["sock"]} sock
 * @param {import("surya").IConfig} config
 */
export const extractPermission = async (msg, sock, config) => {
	const groupMetadata = msg.isGroup
		? await sock.groupMetadata(msg.from)
		: null;

	const isOwner = (
		Array.isArray(config.owners) ? config.owners : [config.owners]
	)
		.map((n) => n.replace(/[^\d]/g, "") + "@s.whatsapp.net")
		.includes(msg.sender);

	const isAdmin =
		msg.isGroup && groupMetadata
			? groupMetadata.participants
					.filter((p) => p.admin)
					.map((p) => p.id)
					.includes(msg.sender)
			: false;
	const isBotAdmin =
		msg.isGroup && groupMetadata
			? groupMetadata.participants
					.filter((p) => p.admin)
					.map((p) => p.id)
					.includes(sock.user?.id ?? "")
			: false;

	return {
		groupMetadata,
		isOwner,
		isAdmin,
		isBotAdmin,
	};
};

export const extractCommand = (
	/** @type {boolean} */
	isCommand,
	/** @type {string | undefined} */ params,
	/** @type {string[]} */ _prefix
) => {
	// trim first space if exist
	const prefix = _prefix.find((p) => params?.startsWith(p)) ?? "";
	let text = isCommand ? params?.slice(prefix.length).trim() : params;
	const args = text?.split(" ") ?? [];

	const command = isCommand ? (args.shift()?.toLowerCase() ?? "") : null;
	text = text?.replace(command ?? "", "").trim() ?? "";
	return {
		command,
		text,
		args,
		prefix,
	};
};
