import type { Config } from "jest";

const config = {
	projects: ["<rootDir>/packages/*/jest.config.ts"],
} satisfies Config;

export default config;
