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

	async callGpt(api, body) {
		return api.post("/gpt/chat", {
			body,
		});
	},
	async callGptVision(api, body, image) {
		const form = new FormData();
		const blob = new Blob([image], { type: "image/jpeg" });
		form.append("image", blob, "image.jpg");
		form.append("data", JSON.stringify(body));
		return api.post("/gpt/vision", {
			body: form,
		});
	},

	sendStreamText: (chunks, updateMsg) => {
		let streamText = "";
		chunks.forEach((part) => {
			streamText += " " + part;
			updateMsg(streamText.trim());
		});
	},

	execute: async function (ctx, { api, text, prefix, command }) {
		if (!text) {
			ctx.reply(`Please provide a text with *${prefix + command}*`);
			return;
		}

		let image;
		const media = ctx.quoted?.media ?? ctx.media;
		if (media && /image/i.test(media?.mimetype)) {
			image = await media.download();
		}

		const [updateMsg] = await ctx.reply("...");
		const body = {
			model: "gpt-4o-mini",
			messages: [
				{
					role: "user",
					content: text,
					// replace non abc characters
					name: ctx.name.replace(/[^a-zA-Z]/g, ""),
				},
			],
		};

		const { data, error } = await this[
			!image ? "callGpt" : "callGptVision"
		](api, body, image);

		if (error) {
			await updateMsg(error.message || "Failed to execute the command");
			return;
		}

		const { status, result, message } = data;

		if (!status || !result?.message) {
			await updateMsg(message || "No response, try again");
			return;
		}

		const { content, images } = result.message;

		const chunks = (
			content
				? content
				: "No response, please try again with cleared instruction."
		).split(" ");

		ctx.isGroup
			? updateMsg(chunks.join(" "))
			: this.sendStreamText(chunks, updateMsg);

		if (images) {
			for (const image of images) {
				await ctx.sock
					.sendMessage(
						ctx.from,
						{
							image: Buffer.from(image, "base64"),
						},
						{ quoted: ctx.message }
					)
					.catch(() => {});
			}
		}
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
