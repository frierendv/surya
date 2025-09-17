import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
	preset: "ts-jest/presets/default-esm",
	moduleNameMapper: {
		"^(\\.{1,2}/.*)\\.js$": "$1",
	},
	transform: {
		"^.+\\.(t|j)sx?$": ["@swc/jest", { sourceMaps: "inline" }],
	},
	testPathIgnorePatterns: ["/node_modules/", "/dist/"],
	modulePathIgnorePatterns: ["<rootDir>/dist/"],
	collectCoverageFrom: ["packages/**/*.{ts}"],
	coverageProvider: "v8",
	coverageReporters: ["text", "lcov"],
	testEnvironment: "node",
	prettierPath: require.resolve("prettier"),
	setupFiles: ["<rootDir>/jest.setup.ts"],
};

export default config;
