import path from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import prettierLint from "eslint-config-prettier/flat";
import turboConfig from "eslint-config-turbo/flat";
import onlyWarn from "eslint-plugin-only-warn";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
	js.configs.recommended,
	eslintConfigPrettier,
	...tseslint.configs.recommended,
	...turboConfig,
	...compat.extends("plugin:prettier/recommended"),
	{
		rules: {
			"turbo/no-undeclared-env-vars": [
				"error",
				{
					allowList: ["^ENV_[A-Z]+$"],
				},
			],
		},
	},
	{
		plugins: {
			turbo: turboPlugin,
		},
		rules: {
			curly: ["error", "all"],
			"no-else-return": ["error", { allowElseIf: false }],
			quotes: ["error", "double", { avoidEscape: true }],
			camelcase: [
				"error",
				{
					properties: "never",
					ignoreDestructuring: false,
					ignoreImports: true,
					allow: ["^[a-z]+(_[a-z]+)+$"],
				},
			],
			semi: ["error", "always"],
			"space-before-function-paren": [
				"error",
				{
					anonymous: "always",
					named: "never",
					asyncArrow: "always",
				},
			],
			"arrow-parens": ["error", "always"],
			"no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
			"no-unused-vars": "off", // Disable the base rule
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					vars: "all",
					args: "after-used",
					ignoreRestSiblings: true,
					varsIgnorePattern: "^_",
					argsIgnorePattern: "^_",
					caughtErrors: "all",
					caughtErrorsIgnorePattern: "^_",
				},
			],

			// disable any rule that is already covered by typescript
			"@typescript-eslint/no-explicit-any": "off",
		},
	},
	{
		plugins: {
			onlyWarn,
		},
	},
	prettierLint,
	{
		ignores: ["dist/**"],
	},
];
