# surya-rb

surya-rb is a lightweight, modular WhatsApp bot runtime written in TypeScript. It focuses on plugin-first development, fast DX, and clear separations for socket, plugins, database, and scheduling.

---

## Highlights

- Modular plugin system with hot-reload
- TypeScript + tsup bundling, fast dev with tsx and dotenvx
- Pluggable persistence: MongoDB or local JSON files
- Built-in job scheduler (cron and interval) with persistent store
- Production-friendly logs via Pino with adjustable `LOG_LEVEL`
- [ItsRose](https://itsrose.net) API integration

---

## Layout (this package)

- `src/` — sources for the runtime, handlers, libs, plugins and scheduler
  - `handler/` — message and plugin dispatch
  - `libs/` — cross-cutting utilities
  - `plugins/` — built-in features grouped by category
  - `socket/` — Baileys socket wrapper and helpers
  - `scheduler/` — cron and interval jobs
  - `types/` — shared types and generated OpenAPI types
- `.env` / `.env.example` — runtime configuration
- `package.json` — scripts and dependencies

```tree
surya-rb
├── package.json
├── src
│   ├── handler
│   │   ├── message.ts
│   │   └── plugin.ts
│   ├── index.ts
│   ├── libs
│   │   ├── auth-provider.ts
│   │   ├── database.ts
│   │   ├── fetch.ts
│   │   ├── logger.ts
│   │   ├── mongodb.ts
│   │   ├── performance.ts
│   │   ├── plugin-manager.ts
│   │   ├── scheduler.ts
│   │   └── sticker.ts
│   ├── plugins
│   ├── scheduler
│   │   ├── crons
│   │   │   ├── index.ts
│   │   │   └── user.ts
│   │   ├── index.ts
│   │   └── intervals
│   │       ├── image.ts
│   │       ├── index.ts
│   │       ├── suno.ts
│   │       └── unmix.ts
│   ├── socket
│   │   ├── index.ts
│   │   ├── pairing.ts
│   │   ├── proxy.ts
│   │   └── socket.ts
│   └── types
│       ├── database.ts
│       └── itsrose-schema.ts
├── tsconfig.json
└── tsup.config.ts
```

> [!IMPORTANT]
> See the per-folder READMEs under `src/*` for deeper docs.

---

## Quickstart

Prerequisites

- Node.js 18+
- npm
- MongoDB (optional; enables Mongo-backed auth state and data storage)
- ItsRose API key (optional; required for specific plugins)

Install dependencies from the monorepo root.

```bash
npm install
```

Create your environment file.

```bash
cp .env.example .env
# edit .env and fill required values
```

Run in development (watches TypeScript and loads plugins from `src`).

```bash
npm run dev --workspace=surya-rb
```

Or build and run the compiled output.

```bash
npm run build
npm run start --workspace=surya-rb
```

> [!NOTE]
>
> - On first launch, pairing is required. If you >set `SR_BOT_NUMBER`, a pairing code will be printed; otherwise a QR code is rendered in the terminal.
> - In dev mode (`npm run dev`), plugins are hot-watched from `src/plugins`.
> - In prod (`npm run start`), plugins are loaded from `dist/plugins`.

If you use ItsRose plugins, configure the API key/URL in `.env` before running.

> [!TIP]
> You can get a free ItsRose API key by signing up at <https://itsrose.net>.

To update ItsRose API types:

```bash
npm run gen:itsrose --workspace=surya-rb
```

---

## Environment variables

Copy `.env.example` to `.env` and review these keys:

- Core
  - `LOG_LEVEL` — logger level: trace|debug|info|warn|error|fatal (default: info)
  - `SR_PREFIXES` — command prefixes, e.g. `!./`
  - `SR_OWNER_NUMBER` — CSV of owner JIDs/phones; e.g. `123@lid,628xxxx`
- Auth state (choose one)
  - `SR_MONGODB_URI` — when set, auth state is stored in MongoDB
  - `SR_MONGODB_DB_NAME` — Mongo database name (default: surya-rb)
  - `SR_AUTH_STATE_DIR` — directory for multi-file auth state if Mongo is not used (default: ./auth_state)
- Bot pairing
  - `SR_BOT_NUMBER` — bot phone number to request a pairing code (optional). Without it, a QR is shown.
- Data storage
  - `SR_DB_DIR` — directory for JSON DB files (default: ./database). If MongoDB is connected, the database layer will also use the same Mongoose connection.
- Scheduler
  - `SR_SCHEDULER_STORE_PATH` — path for persistent job store (default: ./data/jobs.sqlite)
- ItsRose
  - `SR_ITSROSE_API_KEY` — API key
  - `SR_ITSROSE_API_URL` — base URL (default: <https://api.itsrose.net>)

> [!CAUTION]
> Keep secrets out of version control. Use a secret manager in production.

---

## How it runs

- Entry: `src/index.ts`
  - Connects DB, initializes local DB handle, loads and watches plugins, starts the Baileys socket, and starts the scheduler.
- Socket: `src/socket` (pairing code or QR, patched helpers like `sendFile`)
- Plugin manager: `src/libs/plugin-manager.ts`
  - Dev loads from `src/plugins/*.ts`, Prod loads from `dist/plugins/*.js`
- Scheduler: `src/libs/scheduler.ts` + `src/scheduler/*`

See folder READMEs in `src/*` for authoring details.

---

## Developing plugins

Place new plugins under `src/plugins/<category>/<name>.ts`. At minimum, export an object compatible with the plugin manager contract and implement the `execute` handler.

Basic example:

```ts
import type { Plugin } from "@surya/plugin-manager";

const echo: Plugin = {
  name: "echo",
  command: ["echo"],
  category: ["utility"],
  description: "Echo back text",
  async execute(ctx, { sock }) {
    const text = ctx.args.join(" ") || "Nothing to echo";
    await sock.sendMessage(ctx.from, { text });
  },
};

export default echo;
```

> [!TIP]
>
> - Use `logger` from `src/libs/logger` for consistent logs
> - Use `libs/database` where persistence is needed
>
> - Keep business logic small and testable

---

## Troubleshooting

- Build errors: ensure you installed deps at the monorepo root and you're on Node 18+.
- Mongo connection: check `SR_MONGODB_URI` and network access.
- Pairing: set `SR_BOT_NUMBER` to get a numeric code; otherwise scan the QR in the terminal.
- Plugin not detected: ensure the file extension matches the environment (`.ts` in dev, built `.js` in `dist` for prod) and the default export is a valid plugin.

Increase verbosity by setting `LOG_LEVEL=debug`.

---

## Contributing

PRs welcome. Please keep changes focused, add tests when changing behavior, and run lint/typecheck before opening a PR.

---

## License

MIT (see repository root `LICENSE`).
