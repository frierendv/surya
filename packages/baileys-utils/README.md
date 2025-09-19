# @surya/baileys-utils

Utilities to work with the Baileys WhatsApp library in SuryaRB:

- A resilient Baileys socket manager with auto-reconnect and middleware (`BaileysSocket`)
- Message helpers to normalize incoming messages and reply/react/forward (`createMessageContext`)
- Extra context for commands (prefix/command parsing, group/admin flags) (`createExtraMessageContext`)
- Phone number parsing using libphonenumber-js (`getPhoneDetail`)

ESM and CJS builds with TypeScript types.

## Install

```bash
npm i @surya/baileys-utils
```

Peer deps you should have:

```bash
npm i baileys @hapi/boom libphonenumber-js long
```

## Quick start

```ts
import {
  BaileysSocket,
  createMessageContext,
  createExtraMessageContext,
} from '@surya/baileys-utils'
import makeWASocket, {
  useMultiFileAuthState,
  Browsers,
  type BaileysEventMap
} from 'baileys'

// 1) prepare auth state provider
const { state, saveCreds } = await useMultiFileAuthState('./auth')

// 2) create socket manager
const manager = new BaileysSocket({
  authProvider: { state, saveCreds },
  socketConfig: { browser: Browsers.macOS("SuryaRB") },
  maxReconnectAttempts: 0, // unlimited
})

// 3) add middleware to inspect/handle events (optional)
manager.use("*", async (event) => {
  // console.log('event', event)
})

// 4) listen to Baileys events you care about
manager.on('messages.upsert', async ({ messages }) => {
  const sock = manager.socket!
  for (const msg of messages) {
    const ctx = createMessageContext(msg, sock)
    const extra = await createExtraMessageContext(ctx, sock)

    // simple command example
    if (extra.command === 'ping') {
      await ctx.reply('pong')
    }
  }
})

await manager.launch()
```

## API overview

- BaileysSocket
  - new BaileysSocket(options)
    - authProvider: { state, saveCreds } or Promise thereof
    - socketConfig?: `Partial<UserFacingSocketConfig>`
    - browser?: WABrowserDescription
    - maxReconnectAttempts?: number (0 = unlimited)
    - initialReconnectDelayMs?: number (default 2000, with backoff)
  - launch(): start the socket (sets up handlers)
  - stop(): stop and cleanup
  - restart(): stop then launch
  - use(event | '*', middleware): add middleware for Baileys events
  - socket: the current WASocket instance
  - events emitted by manager: 'stopped', 'logged_out', 'reconnecting', 'reconnect_exhausted'

- Message helpers
  - `getMessageText(message)`: extract best-effort text
  - `createMediaInfo(message)`: inspect media and provide a download() helper
  - `createQuotedMessage(message)`: info + actions for quoted message
  - `createMessageContext(webMessageInfo, socket)`: full context + actions
  - `createExtraMessageContext(ctx, socket)`: enrich context with prefix/command, group/admin info

- Phone utilities
  - `getPhoneDetail(jidOrNumber)`: parse e164, country, national number, calling code

## Notes

- This package requires a compatible version of Baileys (tested with ^7.0.0-rc.3)
- Make sure Node.js supports fetch/crypto features required by Baileys or polyfill accordingly.

## TypeScript

Types are bundled. Import what you need:

```ts
import type { CreateBaileysOptions, IMessageContext, IExtraMessageContext } from "@surya/baileys-utils"
```

## License

[![GitHub license](https://img.shields.io/github/license/frierendv/surya)](https://github.com/frierendv/surya/blob/main/LICENSE)
