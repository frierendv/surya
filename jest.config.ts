import type { Config } from "jest";

const config = {
	projects: ["<rootDir>/packages/*/jest.config.ts"],
	coverageProvider: "v8",
	coverageDirectory: "<rootDir>/coverage",
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80,
		},
	},
	testEnvironment: "node",
} satisfies Config;

export default config;
