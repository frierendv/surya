import { fetchClient } from "@/libs/fetch";
import { scheduler } from "@/libs/scheduler";
import type { IPlugin } from "@surya/plugin-manager";

type FaceType = "laugh" | "smile" | "pose_ps" | "cool" | "cspv" | "dimples";
const faceTypes: readonly FaceType[] = [
	"laugh",
	"smile",
	"pose_ps",
	"cool",
	"cspv",
	"dimples",
];

export default {
	name: "facial-expression-changer",
	command: ["faceapp", "facechange"],
	category: ["image"],
	description: "Change facial expression in images using ItsRose API.",
	execute: async (ctx, { command, usedPrefix, sock }) => {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply(
				`Please provide or quote an image to change facial expression.\nUsage: *${usedPrefix + command}* <expression type>\n\nAvailable types:\n${faceTypes
					.map((type) => `- *${type}*`)
					.join("\n")}`
			);
		}
		const expression = (ctx.args[0] ?? "smile").toLowerCase() as FaceType;
		if (!faceTypes.includes(expression)) {
			return ctx.reply(
				`Invalid expression type. Available types are: ${faceTypes
					.map((type) => `*${type}*`)
					.join(", ")}`
			);
		}
		const buffer = await media.download();
		const { editReply } = await ctx.reply(
			"Processing your image, please wait..."
		);
		const { value, error } = await fetchClient.post(
			"/image/facial_expression",
			{
				init_image: Buffer.from(buffer).toString("base64"),
				expression,
			}
		);

		if (error) {
			return editReply(
				`Failed to process image: ${error.message || "Unknown error"}`
			);
		}
		const { status, result, message } = value!.data;
		if (!status || !result?.images) {
			return editReply(
				"Failed to process image: " + (message || "Unknown error")
			);
		}
		if (result.status === "completed") {
			await editReply("Processing completed!");
			const { images } = result!;
			for (const img of images!) {
				await sock.sendFile(ctx.from, img, { quoted: ctx });
			}
			return;
		}
		void scheduler.interval.add(
			`${ctx.sender}:facial-changer`,
			2000,
			"fetch-image-status",
			{
				from: ctx.from,
				sender: ctx.sender,
				taskId: result.task_id!,
				caption: `Here's your image with *${expression}* expression`,
				quoted: {
					key: ctx.key,
					message: ctx.message,
				},
			},
			{ backoffMs: 1000, maxRetries: 3 }
		);
		await editReply(
			"Your image is being processed. This may take a while. You will receive the image once it's done."
		);
	},
} satisfies IPlugin;
