import type { Config } from "jest";
import { createDefaultEsmPreset } from "ts-jest";

export default {
	displayName: "job-scheduler",
	...createDefaultEsmPreset(),
} satisfies Config;
