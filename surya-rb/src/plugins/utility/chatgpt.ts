import { fetchClient } from "@/libs/fetch";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "chatgpt",
	command: ["chatgpt", "gpt"],
	category: ["utility"],
	description: "Chat with ChatGPT.",
	execute: async (ctx, { sock, isGroup }) => {
		if (!ctx.text) {
			await ctx.reply("Please provide a message to send to ChatGPT.");
			return;
		}
		const user = ctx.pushName?.replace(/[^a-zA-Z]/g, "");
		const { editReply } = isGroup
			? await ctx.reply("...")
			: await sock.sendPresenceUpdate("composing", ctx.from).then(() => ({
					editReply: (text: string) => ctx.reply(text),
				}));
		const { value, error } = await fetchClient.post("/gpt/legacy/chat", {
			model: "gpt-4o-mini",
			messages: [
				{
					role: "user",
					content: ctx.text,
					...(user ? { user } : {}),
				},
			],
		});
		if (error) {
			await editReply(error.message || "Failed to execute the command");
			return;
		}
		const { status, result, message } = value!.data;

		if (!status || !result?.message) {
			await editReply(message || "No response, try again");
			return;
		}
		const { content, images } = result.message;

		await editReply(
			content || "No response, please try again with cleared instruction."
		);

		if (images) {
			for (const image of images) {
				await sock.sendMessage(
					ctx.from,
					{
						image: Buffer.from(image, "base64"),
					},
					{ quoted: ctx }
				);
			}
		}
	},
} satisfies IPlugin;
