import type { Config } from "jest";
import { createDefaultEsmPreset } from "ts-jest";

export default {
	displayName: "baileys-utils",
	...createDefaultEsmPreset(),
} satisfies Config;
