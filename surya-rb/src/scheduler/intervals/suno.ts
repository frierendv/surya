import { fetchClient } from "@/libs/fetch";
import { interval } from "@/libs/scheduler";
import { socket } from "@/libs/socket";
import type { JobHandler, JobRecord } from "@surya/job-scheduler";
import type { WAMessage } from "baileys";

type SunoJob = {
	/** user jid or group */
	from: string;
	sender: string;
	songIds: string[];
	quoted?: WAMessage;
};

const handlerKey = "fetch-suno-song-status" as const;
const handler: JobHandler<SunoJob> = async (payload, job) => {
	const { value, error } = await fetchClient.get("/ai_song/get_task", {
		queryParams: { song_id: payload.songIds.join(",") },
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
	const completedSongs = result.filter((song) => song.status === "completed");
	if (completedSongs.length) {
		for (const song of completedSongs) {
			if (!song.audio) {
				continue;
			}
			await socket.sendFile(payload.from, song.audio, {
				ptt: false,
				fileName: song.title ? `${song.title}.mp3` : undefined,
				quoted: payload.quoted,
			});
		}
		void interval.remove(job.id);
		return;
	}
	// if all songs are error
	const allError = result.every((song) => song.status === "error");
	if (allError) {
		await socket.sendMessage(
			payload.from,
			{
				text: "All song generation tasks failed, please try again later.",
			},
			{ quoted: payload.quoted }
		);
		void interval.remove(job.id);
		return;
	}
	// still processing, will check again in next interval
};

const onError = (job: JobRecord<SunoJob>, err: unknown) => {
	const { payload } = job;
	if (!payload) {
		return;
	}
	const errMsg = err instanceof Error ? err.message : String(err);
	void socket
		.sendMessage(
			payload.from,
			{
				text: `Failed to fetch song status: ${errMsg}`,
			},
			{ quoted: payload.quoted }
		)
		.catch();
};

export const fetchSunoJob = {
	handlerKey,
	handler,
	onError,
} as const;
