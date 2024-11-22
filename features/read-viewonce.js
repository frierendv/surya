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

	execute: async function (m, { sock }) {
		const { quoted } = m;
		if (!quoted || !quoted.media) {
			return m.reply("Reply to viewonce message.");
		}
		const mtype = quoted.type;
		if (!/viewOnce/i.test(mtype)) {
			return m.reply("This message isn't viewonce.");
		}
		const { text, media } = quoted;
		const { download, mimetype } = media;
		const buffer = await download();
		if (/audio/.test(mimetype)) {
			return await sock.sendMessage(
				m.from,
				{ audio: buffer, ptt: true },
				{ quoted: m.message }
			);
		}
		await sock.sendMessage(
			m.from,
			// @ts-ignore
			{
				[mimetype.includes("image") ? "image" : "video"]: buffer,
				caption: text ?? "",
			},
			{ quoted: m.message }
		);
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
