import type { Config } from "jest";
import { createDefaultEsmPreset } from "ts-jest";

export default {
	displayName: "ffmpeg-utils",
	...createDefaultEsmPreset(),
} satisfies Config;
