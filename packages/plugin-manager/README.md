# @surya/plugin-manager

A lightweight, file-based plugin loader and watcher. It loads plugins from a directory, indexes their commands, and hot-reloads on file changes (uses chokidar when available, with fs.watch fallback). Built for SuryaRB, but generic enough for other bots or CLIs.

- Loads ESM/CJS modules via dynamic import
- Validates a minimal contract: { name, command, category } + optional fields and hooks
- Emits events: loaded, updated, removed, error
- Finds plugins by command (case-insensitive)
- Optional chokidar watcher with debounced updates
- Prevents duplicate plugin names across files

## Install

```bash
npm i @surya/plugin-manager
```

Peer deps (optional but recommended for robust watching):

```bash
npm i chokidar
```

## Plugin contract

A plugin must export an object (default export is supported) that matches `Plugin`:

```ts
export interface PluginManifest {
 name: string;
 command: string | string[];
 category: string | string[];
 // optional extras
 description?: string;
 ownerOnly?: boolean;
 adminOnly?: boolean;
 privateChatOnly?: boolean;
 groupChatOnly?: boolean;
 hidden?: boolean;
 rateLimit?: { limit: number; windowMs: number };
 /** Match command without requiring a prefix */
 ignorePrefix?: boolean;
 /** Disable this plugin entirely */
 disabled?: boolean;
}

export interface Plugin extends PluginManifest {
 /** Pre-execution hook (preferred). If this throws/returns false, execute/post are skipped. */
 pre?: (
  ctx: IMessageContext,
  extra: IExtraMessageContext
 ) => Promise<boolean | void> | boolean | void;
 /** Main execution. */
 execute?: (
  ctx: IMessageContext,
  extra: IExtraMessageContext
 ) => Promise<void> | void;
 /** Post-execution hook (preferred). */
 post?: (
  ctx: IMessageContext,
  extra: IExtraMessageContext
 ) => Promise<void> | void;
 /** Back-compat (deprecated): use pre/post instead. */
 before?: (
  ctx: IMessageContext,
  extra: IExtraMessageContext
 ) => Promise<boolean | void> | boolean | void;
 after?: (
  ctx: IMessageContext,
  extra: IExtraMessageContext
 ) => Promise<void> | void;
}
```

If you use `@surya/baileys-utils`, you'll get the `IMessageContext` and `IExtraMessageContext` types.

Notes:

- Categories are normalized to Capitalized form.
- Commands are normalized to lowercase. Matching is case-insensitive.
- Default export is supported.

## Usage

```ts
import { PluginManager } from "@surya/plugin-manager";

const pm = new PluginManager({
 rootDir: "./plugins",
 extensions: [".js", ".mjs", ".cjs"],
 recursive: true,
 useChokidar: true, // falls back to fs.watch if not installed
 debounceMs: 100,
});

pm.on("loaded", (file, plugin) => console.log("loaded", plugin.name));
pm.on("updated", (file, plugin) => console.log("updated", plugin.name));
pm.on("removed", (file) => console.log("removed", file));
pm.on("error", (err, file) => console.error("plugin error", file, err));

await pm.load();
await pm.watch();

// later, find by command
const [ping] = pm.findByCommand("ping");
```

## Example plugin

```ts
// plugins/ping.mjs
export default {
 name: "ping",
 command: ["ping", "p"],
 version: "1.0.0",
 description: "Respond with pong",
 category: "utility",
 async execute(ctx, extra) {
  await ctx.reply("pong");
 },
};
```

## API highlights

- new PluginManager(options)
  - rootDir: directory to search
  - extensions?: string[] = ['.js']
  - recursive?: boolean = true
  - ignore?: (absPath, name) => boolean
  - cacheBust?: boolean = true (force reload by query param)
  - useChokidar?: boolean = true
  - debounceMs?: number = 100
  - concurrency?: number = half CPU count (min 2)
  - validate?: (obj) => obj is Plugin
- load(): load all plugins from disk
- watch(): start file watcher
- stop(): stop watcher
- reloadFromFile(filePath): force reload a file
- get(name), list()
- findByCommand(cmd): IPlugin[]
- find(options): Plugin[]

### Events

```ts
pm.on("loaded", (filePath, plugin) => {});
pm.on("updated", (filePath, plugin) => {});
pm.on("removed", (filePath, prev?) => {});
pm.on("error", (err, filePath?) => {});
```

Notes:

- Duplicate plugin names across different files are rejected (the latter load emits an error and is ignored).
- Loads are concurrency-limited to avoid spikes from burst updates.

## TypeScript

Types are included. Import from the package:

```ts
import type { Plugin, PluginManifest } from "@surya/plugin-manager";

// Backward compatibility aliases are also exported
import type { IPlugin, IPluginManifest } from "@surya/plugin-manager";
```

## Testing

From the repo root:

```bash
npm test -- --selectProjects plugin-manager --runInBand
```

## License

This project is licensed under the terms of the [MIT license](https://github.com/frierendv/surya/blob/main/LICENSE).
