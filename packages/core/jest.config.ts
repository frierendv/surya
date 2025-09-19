import type { Config } from "jest";
import { createDefaultEsmPreset } from "ts-jest";

export default {
	displayName: "core",
	...createDefaultEsmPreset(),
} satisfies Config;
