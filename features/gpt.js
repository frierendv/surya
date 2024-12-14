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
					name: ctx.name,
				},
			],
			internal_functions: ["create_ai_art", "brainly"],
			functions: [sendFileTools],
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

		const gptMessage = result.message;
		const fn_response = gptMessage?.function_call || null;

		// Be sure to modify the code to fit your needs
		if (fn_response && fn_response.name === "sendFile") {
			const sent = await sendFile(ctx, JSON.parse(fn_response.arguments));
			await updateMsg(sent || "Failed to send file");
			return;
		}

		await updateMsg(
			gptMessage?.content
				? gptMessage.content
				: "No response, please try again with cleared instruction"
		);
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};

/**
 * Be sure modify the code to fit your needs
 *
 * @param {import("surya").IClientSocket} ctx
 * @param {*} opts
 * @returns
 */
const sendFile = async (ctx, opts) => {
	const { content, caption } = opts;
	const media = await ctx.sock.sendFile(ctx.from, content, {
		caption,
		quoted: ctx,
	});
	return media ? "File sent" : "Failed to send file";
};
// Tooling
const sendFileTools = {
	name: "sendFile",
	description:
		"Return this to send a file like image, video, etc. Any media (url) from your response should be sent as a file not as a message",
	parameters: {
		properties: {
			content: {
				description:
					"content (Buffer, URL, Base64), preferably file url",
				type: "string",
			},
			caption: {
				description: "Caption for the content only for image and video",
				type: "string",
			},
		},
		type: "object",
		required: ["content"],
	},
};
