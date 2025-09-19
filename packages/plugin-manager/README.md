# @surya/plugin-manager

A lightweight, file-based plugin loader and watcher. It loads plugins from a directory, indexes their commands, and hot-reloads on file changes (using chokidar when available, with fs.watch fallback). Built for SuryaRB, but generic enough for other bots or CLIs.

- Loads ESM/CJS modules via dynamic import
- Validates a minimal contract: { name, command, category, description, execute }
- Emits events: loaded, updated, removed, error
- Finds plugins by command (case-insensitive)
- Optional chokidar watcher with debounced updates

## Install

```bash
npm i @surya/plugin-manager
```

Peer deps (optional but recommended for robust watching):

```bash
npm i chokidar
```

## Plugin contract

A plugin must export an object (default export is supported) that matches `IPlugin`:

```ts
export interface IPluginManifest {
  name: string;
  command: string | string[];
  version?: string;
  category: string | string[];
  description: string;
  ownerOnly?: boolean;
  adminOnly?: boolean;
  privateChatOnly?: boolean;
  groupChatOnly?: boolean;
  hidden?: boolean;
  rateLimit?: { limit: number; windowMs: number };
}

export interface IPlugin extends IPluginManifest {
  before?: (ctx: IMessageContext, extra: IExtraMessageContext) => Promise<boolean> | boolean;
  execute: (ctx: IMessageContext, extra: IExtraMessageContext) => Promise<void>;
  after?: (ctx: IMessageContext, extra: IExtraMessageContext) => Promise<void> | void;
}
```

If you use `@surya/baileys-utils`, you'll get the `IMessageContext` and `IExtraMessageContext` types.

## Usage

```ts
import { PluginManager } from '@surya/plugin-manager'

const pm = new PluginManager({
  rootDir: './plugins',
  extensions: ['.js', '.mjs', '.cjs'],
  recursive: true,
  useChokidar: true, // falls back to fs.watch if not installed
  debounceMs: 100,
})

pm.on('loaded', (file, plugin) => console.log('loaded', plugin.name))
pm.on('updated', (file, plugin) => console.log('updated', plugin.name))
pm.on('removed', (file) => console.log('removed', file))
pm.on('error', (err, file) => console.error('plugin error', file, err))

await pm.loadAll()
await pm.watch()

// later, find by command
const [ping] = pm.findByCommand('ping')
```

## Example plugin

```ts
// plugins/ping.mjs
export default {
  name: 'ping',
  command: ['ping', 'p'],
  version: '1.0.0',
  description: 'Respond with pong',
  category: 'utility',
  async execute(ctx, extra) {
    await ctx.reply('pong')
  }
}
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
  - concurrency?: number = cpuCount (import limiter)
  - validate?: (obj) => obj is IPlugin
- loadAll(): load all plugins from disk
- watch(): start file watcher
- stop(): stop watcher
- reloadFromFile(filePath): force reload a file
- get(name), list()
- findByCommand(cmd): IPlugin[]

## TypeScript

Types are included. Import from the package:

```ts
import type { IPlugin, IPluginManifest } from '@surya/plugin-manager'
```

## Testing

From the repo root:

```bash
npm test -- --selectProjects plugin-manager --runInBand
```

## License

This project is licensed under the terms of the [MIT license](https://github.com/frierendv/surya/blob/main/LICENSE).
