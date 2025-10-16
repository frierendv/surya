import { fetchImageJob } from "./image";
import { fetchSunoJob } from "./suno";
import { fetchUnmixJob } from "./unmix";

export const intervalJobs = [
	fetchImageJob,
	fetchSunoJob,
	fetchUnmixJob,
] as const;
