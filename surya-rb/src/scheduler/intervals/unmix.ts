import { fetchClient } from "@/libs/fetch";
import { interval } from "@/libs/scheduler";
import { socket } from "@/libs/socket";
import type { JobHandler, JobRecord } from "@surya/job-scheduler";
import type { WAMessage } from "baileys";

type UnmixJob = {
	/** user jid or group */
	from: string;
	sender: string;
	taskId: string;
	quoted?: WAMessage;
};

const handlerKey = "fetch-unmix-status" as const;
const handler: JobHandler<UnmixJob> = async (payload, job) => {
	const { value, error } = await fetchClient.get("/unmix/get_task", {
		queryParams: { task_id: payload.taskId },
	});
	if (error) {
		await socket.sendMessage(
			payload.from,
			{
				text: `Failed to fetch song status: ${error.message || "Unknown error"}`,
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
	const { status, audio_files } = result;
	switch (status) {
		case "processing":
			// still processing, do nothing
			return;
		case "completed":
			if (audio_files && audio_files.length) {
				for (const audio of audio_files) {
					if (!audio || !audio.audio_url) {
						continue;
					}
					await socket.sendFile(payload.from, audio.audio_url, {
						ptt: false,
						fileName: audio?.name ?? `unmix-${payload.taskId}.mp3`,
						quoted: payload.quoted,
					});
				}
			}
			void interval.remove(job.id);
			return;
		case "error":
			await socket.sendMessage(
				payload.from,
				{
					text: message || "Unknown error",
				},
				{ quoted: payload.quoted }
			);
			void interval.remove(job.id);
			return;
		default:
			await socket.sendMessage(
				payload.from,
				{
					text: "Unknown status",
				},
				{ quoted: payload.quoted }
			);
			void interval.remove(job.id);
			return;
	}
};

const onError = (job: JobRecord<UnmixJob>, err: any) => {
	const { payload } = job as JobRecord<UnmixJob>;
	if (!payload) {
		return;
	}
	const errMsg = err instanceof Error ? err.message : String(err);
	void socket
		.sendMessage(
			payload.from,
			{
				text: `Failed to fetch unmix status: ${errMsg}`,
			},
			{ quoted: payload.quoted }
		)
		.catch();
};

export const fetchUnmixJob = {
	handlerKey,
	handler,
	onError,
} as const;
