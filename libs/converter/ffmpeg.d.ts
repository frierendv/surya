import { FfmpegCommand } from "fluent-ffmpeg";
import { Readable } from "stream";

export type Commands = {
	[K in keyof Omit<FfmpegCommand, "input">]: Parameters<
		FfmpegCommand[K] extends (args: any[]) => FfmpegCommand
			? (args: Parameters<FfmpegCommand[K]>) => Commands
			: FfmpegCommand[K]
	>[0];
};

type F = {
	(
		/** The input buffer or readable stream. */
		input: Buffer | Readable,
		/** The commands to apply. */
		commands: Partial<Commands>
	): {
		/**
		 * @returns {Promise<Buffer>}
		 */
		exec(): Promise<Buffer>;
	};
};

declare const Ffmpeg: F;
