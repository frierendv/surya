/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["readviewonce", "rvo"],
	description: "Read view once.",
	category: "Utility",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { sock }) {
		const { quoted } = ctx;
		if (!quoted || !quoted.media) {
			return ctx.reply("Reply to viewonce message.");
		}
		const mtype = quoted.type;
		if (!/viewOnce/i.test(mtype)) {
			return ctx.reply("This message isn't viewonce.");
		}
		const { text, media } = quoted;
		const { download, mimetype } = media;
		const buffer = await download();
		if (/audio/.test(mimetype)) {
			return await sock.sendMessage(
				ctx.from,
				{ audio: buffer, ptt: true },
				{ quoted: ctx.message }
			);
		}
		await sock.sendMessage(
			ctx.from,
			// @ts-ignore
			{
				[mimetype.includes("image") ? "image" : "video"]: buffer,
				caption: text ?? "",
			},
			{ quoted: ctx.message }
		);
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
