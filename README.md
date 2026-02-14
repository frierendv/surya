# Surya

A lightweight, modular WhatsApp bot runtime built with TypeScript and [Baileys](https://github.com/WhiskeySockets/Baileys).

Surya provides a plugin-first architecture for building WhatsApp bots with fast hot-reload, persistent state management, job scheduling, and media processing capabilities.

---

## ✨ Features

- **Plugin System**: Hot-reloadable plugins with lifecycle hooks and automatic discovery
- **WhatsApp Integration**: Built on Baileys with support for pairing codes and QR authentication
- **Job Scheduling**: SQLite-backed cron and interval scheduler for automated tasks
- **Flexible Storage**: Choose between local JSON files or MongoDB for data persistence
- **Media Processing**: FFmpeg utilities for image, video, and audio manipulation
- **Production Ready**: Structured logging with Pino, persistent auth state, and low memory footprint
- **Developer Experience**: Fast TypeScript bundling with tsup, hot-reload in development
- **API Integration**: Built-in ItsRose API support for advanced features

---

## 📦 Installation

### Prerequisites

- **Node.js** 20 or higher
- **npm** 10.9.2 or higher (included with Node.js)
- **MongoDB** (optional, for cloud-based storage and auth state)
- **FFmpeg** (optional, for media processing features)

### Setup

Clone the repository:

```bash
git clone https://github.com/frierendv/surya.git
cd surya
```

Install dependencies:

```bash
npm install
```

Configure environment variables:

```bash
cp surya-rb/.env.example surya-rb/.env
# Edit the file with your preferred editor
nano surya-rb/.env  # or use vim, code, etc.
```

Required environment variables:

```env
SR_OWNER_NUMBER="1234567890"     # Your phone number with country code
SR_PREFIXES="!./"                 # Command prefixes
SR_DB_DIR="./database"           # Directory for local database
```

Optional environment variables:

```env
SR_MONGODB_URI="mongodb://localhost:27017"  # MongoDB connection
SR_MONGODB_DB_NAME="surya-rb"               # Database name
SR_ITSROSE_API_KEY="YOUR_API_KEY"          # ItsRose API key
```

---

## 🚀 Quick Start

Start the bot in development mode:

```bash
npm run dev --workspace=surya-rb
```

On first launch:

- **With pairing code**: Set `SR_BOT_NUMBER` in `.env`, then enter the code on your phone
- **With QR code**: Scan the QR displayed in the terminal

The bot is ready when you see:

```text
Connection successful
Loaded X plugins
```

Send a message to the bot: `!ping`

---

## 🛠 Usage

### Running the Bot

**Development mode** (with hot-reload):

```bash
npm run dev --workspace=surya-rb
```

**Production mode**:

```bash
# Build all packages
npm run build

# Start the bot
npm start --workspace=surya-rb
```

### Available Commands

Built-in plugin categories:

| Category     | Description | Examples |
|--------------|-------------|----------|
| **Utility**  | General-purpose commands | ping, test, ChatGPT |
| **Downloader** | Download media from platforms | YouTube, TikTok, Instagram |
| **Image** | Image processing | remini, background removal, face swap |
| **Audio** | Audio manipulation | TTS, audio unmix, Suno AI |
| **Group** | WhatsApp group management | hide tag, kick member |
| **Admin/Owner** | Administrative commands | shell, plugin management |

### Command Syntax

```text
<prefix><command> [arguments]
```

Examples:

```text
!ping
!youtube https://youtube.com/watch?v=...
!remini <reply to image>
```

### Configuration Options

Edit `surya-rb/.env` to customize:

| Variable     | Description | Default |
|--------------|-------------|---------|
| `LOG_LEVEL`  | Logging level (trace, debug, info, warn, error, fatal) | `info` |
| `SR_PREFIXES` | Command prefixes (no spaces) | `!./` |
| `SR_OWNER_NUMBER` | Owner phone numbers (comma-separated) | - |
| `SR_BOT_NUMBER` | Bot phone number for pairing code | - |
| `SR_DB_DIR` | Local database directory | `./database` |
| `SR_MONGODB_URI` | MongoDB connection string | - |
| `SR_AUTH_STATE_DIR` | Auth state directory (if not using MongoDB) | `./auth_state` |
| `SR_SCHEDULER_STORE_PATH` | Scheduler database path | `./data/scheduler.sqlite` |
| `SR_ITSROSE_API_KEY` | ItsRose API key | - |
| `SR_ITSROSE_API_URL` | ItsRose API base URL | `https://api.itsrose.net` |

---

## 📁 Project Structure

```text
surya/
├── packages/                     # Shared packages (monorepo)
│   ├── core/                    # Utilities (logger, helpers)
│   ├── plugin-manager/          # Plugin loading and hot-reload
│   ├── job-scheduler/           # Cron and interval scheduling
│   ├── database/                # JSON document store with MongoDB sync
│   ├── mongodb-auth-state/      # WhatsApp auth state storage
│   ├── baileys-utils/           # WhatsApp message utilities
│   ├── ffmpeg-utils/            # Media processing
│   └── ...
├── surya-rb/                    # Main bot runtime
│   ├── src/
│   │   ├── index.ts            # Entry point
│   │   ├── socket/             # WhatsApp connection
│   │   ├── handler/            # Message and plugin dispatch
│   │   ├── plugins/            # Built-in plugins
│   │   ├── scheduler/          # Job definitions
│   │   ├── libs/               # Core libraries
│   │   └── types/              # TypeScript types
│   ├── .env.example            # Configuration template
│   └── package.json
├── turbo.json                   # Monorepo build config
└── package.json                 # Root workspace
```

---

## ⚙️ Configuration

### Storage Options

**Local JSON Storage** (default):

```env
SR_DB_DIR="./database"
SR_AUTH_STATE_DIR="./auth_state"
```

Files are stored as individual JSON documents on disk.

**MongoDB Storage**:

```env
SR_MONGODB_URI="mongodb://localhost:27017"
SR_MONGODB_DB_NAME="surya-rb"
```

Auth state and database will use MongoDB. Local JSON files are still used as a cache.

### Authentication

**Pairing Code** (recommended):

```env
SR_BOT_NUMBER="1234567890"  # Your bot's phone number
```

Run the bot and enter the displayed code on your phone.

**QR Code**:

Leave `SR_BOT_NUMBER` unset. Scan the QR code in the terminal.

### ItsRose API

Sign up at [itsrose.net](https://itsrose.net) to get an API key:

```env
SR_ITSROSE_API_KEY="your_key_here"
SR_ITSROSE_API_URL="https://api.itsrose.net"
```

Required for AI-powered image and audio plugins.

---

## 🧪 Development

### Running Locally

```bash
npm run dev --workspace=surya-rb
```

Plugins hot-reload when you edit `surya-rb/src/plugins/`.

### Creating a Plugin

Create `surya-rb/src/plugins/utility/hello.ts`:

```typescript
import type { Plugin } from "@surya/plugin-manager";

const hello: Plugin = {
  name: "hello",
  command: ["hello", "hi"],
  category: ["utility"],
  description: "Say hello",
  async execute(ctx, { sock }) {
    await sock.sendMessage(ctx.from, { 
      text: `Hello, ${ctx.sender}!` 
    });
  },
};

export default hello;
```

The plugin is automatically loaded when saved.

### Testing

Run all tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:cov
```

Tests are located in `__tests__/` directories within each package.

### Linting

Check for issues:

```bash
npm run lint
```

Auto-fix:

```bash
npm run lint:fix
```

Format code:

```bash
npm run format
```

### Building

Build all packages:

```bash
npm run build
```

Build only shared packages:

```bash
npm run build:pkg
```

### Type Checking

```bash
npm run typecheck
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Opening Issues

- **Bug reports**: Include steps to reproduce, expected vs actual behavior, and logs
- **Feature requests**: Describe the use case and proposed solution
- **Questions**: Use GitHub Discussions for general questions

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes:
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed
4. Run tests and linting:

   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```

5. Commit with a clear message: `git commit -m "feat: add feature"`
6. Push to your fork: `git push origin feature/your-feature`
7. Open a pull request

### Coding Expectations

- Write TypeScript with strict types
- Keep plugins focused and single-purpose
- Add JSDoc comments for public APIs
- Follow the existing project structure
- Use Pino for logging
- Handle errors gracefully

---

## 📜 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

Copyright (c) 2024-2026 FrierenDv

---

## Acknowledgements

Built with:

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API implementation
- [ItsRose](https://itsrose.net) - API services

Surya is the successor to [SuryaRB](https://github.com/frierendv/SuryaRB), rebuilt from the ground up with improved performance and maintainability.
