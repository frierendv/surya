import type { Config } from "jest";
import { createDefaultEsmPreset } from "ts-jest";

export default {
	displayName: "mongodb-auth-state",
	...createDefaultEsmPreset(),
} satisfies Config;
