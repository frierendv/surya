import type { Config } from "jest";
import { createDefaultEsmPreset } from "ts-jest";

export default {
	displayName: "plugin-manager",
	coveragePathIgnorePatterns: ["/__tests__/", "/__fixtures__/", "/dist/"],
	...createDefaultEsmPreset(),
} satisfies Config;
