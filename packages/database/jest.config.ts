import type { Config } from "jest";
import { createDefaultEsmPreset } from "ts-jest";

export default {
	displayName: "database",
	...createDefaultEsmPreset(),
} satisfies Config;
