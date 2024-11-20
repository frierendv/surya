/** @type {import('jest').Config} */
const config = {
	clearMocks: true,
	moduleNameMapper: {
		"^(\\.{1,2}/.*)\\.js$": "$1",
	},
	transform: {
		"^.+\\.(t|j)sx?$": ["@swc/jest", { sourceMaps: "inline" }],
	},
	collectCoverage: true,
	coverageDirectory: "coverage",
	coverageProvider: "v8",
	coverageReporters: ["text", "lcov"],
	testEnvironment: "node",
	prettierPath: "<rootDir>/node_modules/prettier",
	setupFiles: ["<rootDir>/jest.setup.js"],
	moduleDirectories: ["node_modules"],
	modulePaths: ["<rootDir>"],
};

export default config;
