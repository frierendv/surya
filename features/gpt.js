// @ts-nocheck
/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["ai", "gpt"],
	description: "Chat with AI",
	category: "AI",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (m, { api, text, prefix, command }) {
		if (!text) {
			m.reply(`Please provide a text with *${prefix + command}*`);
			return;
		}

		let image;
		const media = m.quoted?.media ?? m.media;
		if (media && /image/i.test(media?.mimetype)) {
			image = await media.download();
		}

		let path = "/gpt/chat";
		let body = {
			model: "gpt-4o-mini",
			messages: [
				{
					role: "user",
					content: text,
					name: m.name,
				},
			],
		};
		if (image) {
			path = "/gpt/vision";
			const form = new FormData();
			const blob = new Blob([image], { type: "image/jpeg" });
			form.append("image", blob, "image.jpg");
			form.append("data", JSON.stringify(body));
			body = form;
		}

		const { data, error } = await api.post(path, {
			body,
		});
		if (error) {
			m.reply(error.message);
			return;
		}
		const { status, result, message } = data;
		if (!status || !result?.message?.content) {
			m.reply(message);
			return;
		}
		m.reply(result.message.content);
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
