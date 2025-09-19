# @surya/core

Small, dependency-light utilities used across the Surya monorepo. Ships ESM and CJS builds with TypeScript types.

## Install

Install from npm (or your registry):

```bash
npm i @surya/core
# or
pnpm add @surya/core
# or
yarn add @surya/core
```

## Quick start

```ts
// ESM
import { createLogger } from '@surya/core/logger'
import { readDirFiles, walkDirFiles } from '@surya/core/readdir'
import { debounce } from '@surya/core/debounce'
import { capitalize } from '@surya/core/string'

const log = createLogger({ name: 'example' })
log.info('hello world')

const say = debounce((name: string) => log.info(`hi ${name}`), 200)
say('Surya')

console.log(capitalize('surya')) // Surya

await walkDirFiles('.', { recursive: true, onPath: (p) => log.debug('file', { p }) })
```

## API

- logger
  - createLogger(opts?) -> Logger: fast, zero-dep logger with env-based level (LOG_LEVEL) and pretty dev output or JSON in production.
  - logger.child({ name, context }) to add fields to all logs.
  - logger.time(label) returns end() that logs duration at debug level.
- readdir
  - readDirFiles(dir, { recursive?, filter?, ignore?, encoding?, concurrency?, onFile?, onError? }): Read all files concurrently (Semaphore limited). Returns Map<absPath, Buffer|string>.
  - walkDirFiles(dir, { recursive?, filter?, ignore?, onPath, onError? }): Visit each file path with your callback.
- debounce
  - debounce(fn, ms): Return debounced function.
- string
  - capitalize(str, { locale?, lowerRest? })
- semaphore (internal for readdir): simple concurrency helper.

See source under `packages/core/src` and tests under `packages/core/__tests__` for usage examples.

## TypeScript

- Full type definitions included. No extra config needed.

## Testing

This package ships with Jest tests. From the repo root:

```bash
npm test -- --selectProjects core --runInBand
```

## License

This project is licensed under the terms of the [MIT license](https://github.com/frierendv/surya/blob/main/LICENSE).
