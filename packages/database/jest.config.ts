import type { Config } from "jest";
import { createDefaultEsmPreset } from "ts-jest";

const tsEsm = createDefaultEsmPreset();
export default {
	displayName: "database",
	...tsEsm,
	transform: {
		...tsEsm.transform!,
		"^.+\\.(m?[tj]s|cts|mts)$": [
			"babel-jest",
			{
				presets: [
					["@babel/preset-env", { targets: { node: "current" } }],
					"@babel/preset-typescript",
				],
				plugins: [
					"@babel/plugin-transform-explicit-resource-management",
				],
			},
		],
	},
} satisfies Config;
