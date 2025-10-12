# Surya RB

A lightweight, modular chat-bot runtime and plugin framework written in TypeScript. "Surya RB" powers small-to-medium bot projects with a focus on modular plugins, performance, and developer ergonomics.

---

## Highlights

- Modular plugin architecture with first-class support for audio, image, downloader and owner-only utilities
- Written in TypeScript and bundled using `tsup` for fast builds
- Small, focused libs for logging, MongoDB integration, performance measurements, and sticker utilities
- Testable codebase and example plugins for common bot features

---

## Repository layout (relevant to this package)

Files and folders in this package:

- `src/` — TypeScript source for the runtime, handlers, libs and plugins
  - `handler/` — message and plugin handling logic
  - `libs/` — helper modules (fetch, logger, mongodb, performance, plugin-manager, sticker)
  - `plugins/` — built-in plugins (audio, downloader, group, image, main, owner, privacy, utility)
- `.env` / `.env.example` — environment variables used by the runtime
- `package.json` — package manifest with scripts and dependencies

---

## Quickstart

Prerequisites

- Node.js >= 18 (or the project's supported Node version)
- npm
- MongoDB to use the `mongodb` integration
- [ItsRose](https://itsrose.net) API keys (if using ItsRose plugins)

1. Clone the monorepo and change into the package folder (or, from the repo root):

  ```bash
  cd surya-rb
  ```

2. Install dependencies (from monorepo root is recommended):

 ```bash
 # from the repo root
 npm install
 ```

3. Copy `.env.example` to `.env` and set values (see Environment section):

 ```bash
 cp .env.example .env
 # edit .env to add real secrets/urls
 ```

4. Build the package:

 ```bash
 npm run build --workspace=surya-rb
 ```

5. Run the built output:

 ```bash
 # run the built output (example)
 node dist/index.js
 ```

Note: The repository contains top-level scripts and task definitions.

If using ItsRose plugins, ensure you set the relevant API keys in `.env` before running.

To update API types, run:

```bash
npm run gen:itsrose --workspace=surya-rb
```

---

## Environment

Copy `.env.example` to `.env` and provide values for:

- SR_MONGODB_URI — connection string used by `libs/mongodb.ts`
- LOG_LEVEL — optional verbosity control used by the logger

Secrets should be kept out of source control. Use `.env` in local development and a secure secret manager for production.

---

## Development notes

- Source entry: `src/index.ts` — the runtime bootstrap
- Handlers:
  - `src/handler/message.ts` — message dispatching and plugin invocation
  - `src/handler/plugin.ts` — plugin registration and lifecycle helpers
- Libraries:
  - `src/libs/plugin-manager.ts` — loading and managing plugin modules
  - `src/libs/mongodb.ts` — lightweight MongoDB driver wrapper
  - `src/libs/logger.ts` — common logger utilities

If you add a plugin, follow the structure used by the existing plugins in `src/plugins/*` and register it via the plugin manager.

---

## Plugins

Plugins live under `src/plugins` and are grouped by purpose. Each plugin is a TypeScript module that exports the handlers the plugin needs. Guidelines:

- Keep plugin logic small and focused (single responsibility)
- Prefer pure functions for text processing to make testing easier
- Use `libs/logger` for consistent logs
- If a plugin needs persistence, use `libs/mongodb` or provide your own data driver

Example plugin structure:

```ts
import type { IPlugin } from "@surya/plugin-manager";

const testPlugin: IPlugin = {
 name: "test-command", // plugin name for logging
 command: ["test"], // command triggers (e.g. /test)
 category: ["utility"], // plugin category
 description: "Test command", // short description
 before: async (ctx) => {
   // precondition checks
   // do something before main handler
 },
 execute: async (ctx, { sock }) => {
   await sock.sendMessage(ctx.from, { text: "Test command executed" });
 },
 after: async (ctx) => {
   // cleanup or logging after main handler
  },
};

export default testPlugin;
```

---

## Testing

TODO: Add tests and instructions

---

## Troubleshooting

- Build fails citing missing types or tsconfig: ensure you installed devDependencies from the monorepo root and the TypeScript version matches `tsconfig.json`.
- MongoDB connection issues: verify `SR_MONGODB_URI` and that your network allows outbound connections to the DB instance.
- Plugin not loading: confirm the plugin file is exported correctly and the plugin manager discovers it (see `src/libs/plugin-manager.ts`).

If uncertain, run the same command with increased log level (set `LOG_LEVEL=debug`) to see more details.

---

## Contributing

Contributions are welcome. When opening pull requests please:

- Keep changes focused and small
- Add or update tests for new behavior
- Run linting and tests locally before opening a PR

See the repository `CONTRIBUTING.md` (if present) and existing PRs for patterns used in this monorepo.

---

## License

This package follows the repository license (see top-level `LICENSE`).
