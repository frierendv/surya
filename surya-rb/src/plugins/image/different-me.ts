import { fetchClient } from "@/libs/fetch";
import { scheduler } from "@/libs/scheduler";
import type { IPlugin } from "@surya/plugin-manager";

// a brief description of the plugin
const description = `Different Me, change your image with different style.

Usage: *command <style id>*

We have many styles available, you can find the list of styles id at https://itsrose.net/docs#tag/image/post/image/different_me

If no style id is provided, the default style 'k_comic' will be used.`;

export default {
	name: "different-me",
	command: ["different-me", "diffme"],
	category: ["image"],
	description,
	execute: async (ctx, { command, sock, usedPrefix }) => {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply(
				`Please reply/send an image. Type *${usedPrefix}help ${command}* for more information.`
			);
		}
		const styleId = ctx.args[0]?.toLowerCase() || "k_comic";
		const buffer = await media.download();

		const { editReply } = await ctx.reply(
			"Processing your image, please wait..."
		);

		const { value, error } = await fetchClient.post("/image/different_me", {
			init_image: Buffer.from(buffer).toString("base64"),
			// we handle style errors on server
			style_id: styleId as any,
			sync: false,
		});

		if (error) {
			return editReply(
				`Failed to process image: ${error.message || "Unknown error"}`
			);
		}
		const { status: rspStatus, result, message } = value!.data;
		if (!rspStatus || !result) {
			return editReply(message);
		}

		if (result.status === "completed") {
			await editReply("Processing completed!");
			const { images } = result!;
			for (const img of images!) {
				await sock.sendFile(ctx.from, img, { quoted: ctx });
			}
			return;
		}

		scheduler.interval.add(
			`${ctx.sender}:different-me`,
			2000,
			"fetch-image-status",
			{
				from: ctx.from,
				sender: ctx.sender,
				taskId: result.task_id!,
				caption: `Here's your different me image with style *${styleId}*`,
				// idk mate, we'll figure it out later
				quoted: {
					key: ctx.key,
					message: ctx.message,
				},
			},
			{ backoffMs: 1000, maxRetries: 3 }
		);
		return editReply(
			`Your image is being processed with style *${styleId}*. You will receive the result soon!`
		);
	},
} satisfies IPlugin;
