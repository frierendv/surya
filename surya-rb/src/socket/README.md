# surya-rb/socket

Baileys socket integration and pairing helpers for surya-rb.

- `socket.ts` — creates and manages the socket lifecycle, attaches `sendFile`, and routes `messages.upsert` to the handlers
- `index.ts` — exports `createSocket` and a minimal `socket` facade with `sendMessage` and `sendFile`
- `pairing.ts` — handles pairing by printing a numeric code (when `SR_BOT_NUMBER` is set) or rendering a QR in the terminal

## Environment

- `SR_BOT_NUMBER` — numeric phone used to request a pairing code (optional)
- `LOG_LEVEL` — set to `debug` for verbose Baileys logs

> [!NOTE]
>
> - In dev, plugins are loaded from `src/plugins` and updated live
> - The exported `socket` facade is populated after connection is `open`
> - The current `messages.upsert` handler ignores messages not sent by the bot (for testing): see `socket.ts` and adjust the `fromMe` check as needed
