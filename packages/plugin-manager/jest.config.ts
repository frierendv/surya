import type { Config } from "jest";
import { createDefaultEsmPreset } from "ts-jest";

export default {
	displayName: "plugin-manager",
	...createDefaultEsmPreset(),
} satisfies Config;
