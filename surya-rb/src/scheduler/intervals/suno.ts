import { fetchClient } from "@/libs/fetch";
import { interval } from "@/libs/scheduler";
import { socket } from "@/socket";
import type { JobHandler, JobRecord } from "@surya/job-scheduler";
import type { WAMessage } from "baileys";

type SunoJob = {
	/** user jid or group */
	from: string;
	sender: string;
	taskId: string[];
	quoted?: WAMessage;
};

const handlerKey = "fetch-suno-song-status" as const;
const handler: JobHandler<SunoJob> = async (payload, job) => {
	const { value, error } = await fetchClient.get("/ai_song/get_task", {
		queryParams: { task_id: payload.taskId.join(",") },
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
		const firstCompletedSong = completedSongs[0];
		const messageLines = [
			"Here are your generated song(s)! Enjoy! 🎵\n",
			"Title: " + (firstCompletedSong?.title || "N/A"),
			"Lyrics: " + (firstCompletedSong?.lyrics || "N/A"),
		];
		const msg = await socket.sendMessage(
			payload.from,
			{
				text: messageLines.join("\n"),
			},
			{ quoted: payload.quoted }
		);
		for (const song of completedSongs) {
			if (!song.audio_url) {
				continue;
			}
			await socket.sendFile(payload.from, song.audio_url, {
				ptt: false,
				fileName: song.title ? `${song.title}.mp3` : undefined,
				quoted: msg,
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
