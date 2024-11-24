/**
 * @param {import("@frierendv/frieren").Baileys.IContextMessage} ctx
 * @param {import("@frierendv/frieren").Baileys.WASocket["sock"]} sock
 * @param {import("surya").IConfig} config
 */
export const extractPermission = async (ctx, sock, config) => {
	const groupMetadata = ctx.isGroup
		? await sock.groupMetadata(ctx.from)
		: null;

	const isOwner = (
		Array.isArray(config.owners) ? config.owners : [config.owners]
	)
		.map((n) => n.replace(/[^\d]/g, "") + "@s.whatsapp.net")
		.includes(ctx.sender);

	const isAdmin =
		ctx.isGroup && groupMetadata
			? groupMetadata.participants
					.filter((p) => p.admin)
					.map((p) => p.id)
					.includes(ctx.sender)
			: false;
	const isBotAdmin =
		ctx.isGroup && groupMetadata
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

export const normalizeCommand = (
	/** @type {string | string[]} */
	command
) => {
	return Array.isArray(command) ? command : [command];
};
