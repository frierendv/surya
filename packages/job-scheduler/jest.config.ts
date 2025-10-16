import type { Config } from "jest";
import { createDefaultEsmPreset } from "ts-jest";

export default {
	displayName: "job-scheduler",
	testMatch: ["**/__tests__/*.test.ts"],
	...createDefaultEsmPreset(),
} satisfies Config;
