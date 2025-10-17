import { fetchClient } from "@/libs/fetch";
import { interval } from "@/libs/scheduler";
import { socket } from "@/libs/socket";
import type { JobHandler, JobRecord } from "@surya/job-scheduler";
import type { WAMessage } from "baileys";

type ImageJob = {
	from: string;
	sender: string;
	taskId: string;
	caption?: string;
	quoted?: WAMessage;
};

const handlerKey = "fetch-image-status" as const;
const handler: JobHandler<ImageJob> = async (payload, job) => {
	const { value, error } = await fetchClient.get("/image/get_task", {
		queryParams: { task_id: payload.taskId },
	});
	if (error) {
		await socket.sendMessage(
			payload.from,
			{
				text: `Failed to fetch image status: ${error.message || "Unknown error"}`,
			},
			{ quoted: payload.quoted }
		);
		void interval.remove(job.id);
		return;
	}
	const { status: rspStatus, result, message } = value!.data;
	if (!rspStatus || !result) {
		await socket.sendMessage(
			payload.from,
			{
				text: message || "Unknown error",
			},
			{ quoted: payload.quoted }
		);
		void interval.remove(job.id);
		return;
	}
	const { status, images } = result;

	switch (status) {
		case "processing":
			// still processing, do nothing
			return;
		case "completed":
			if (images && images.length) {
				const parseImages = images.map((img) => {
					if (typeof img === "string") {
						return img;
					}
					return img?.url as string;
				});

				for (const img of parseImages) {
					if (!img) {
						continue;
					}
					await socket.sendFile(payload.from, img, {
						caption: payload.caption,
						quoted: payload.quoted,
					});
				}
			} else {
				await socket.sendMessage(
					payload.from,
					{
						text: "No images found, please try again later.",
					},
					{ quoted: payload.quoted }
				);
			}

			void interval.remove(job.id);
			return;
		case "error":
			await socket.sendMessage(
				payload.from,
				{
					text: "Failed to process image, please try again later.",
				},
				{ quoted: payload.quoted }
			);
			void interval.remove(job.id);
			return;
		default:
			await socket.sendMessage(
				payload.from,
				{
					text: "Unknown status, please try again later.",
				},
				{ quoted: payload.quoted }
			);
			void interval.remove(job.id);
			return;
	}
};

const onError = (job: JobRecord<ImageJob>, err: any) => {
	const { payload } = job;
	if (!payload) {
		void interval.remove(job.id);
		return;
	}
	const errMsg = err instanceof Error ? err.message : String(err);
	void socket
		.sendMessage(
			payload.from,
			{
				text: `Failed to fetch image status: ${errMsg}`,
			},
			{ quoted: payload.quoted }
		)
		.catch();
};

export const fetchImageJob = {
	handlerKey,
	handler,
	onError,
} as const;
