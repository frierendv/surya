# surya-rb/plugins

Built-in plugins for surya-rb, grouped by purpose.

> [!CAUTION]
> Each plugin should default-export a plugin object consumed by the plugin manager.

## Categories

- `audio/` — audio processing features
- `downloader/` — downloading features
- `group/` — group utilities
- `image/` — image manipulations
- `main/` — top-level/general commands
- `owner/` — owner-only commands
- `privacy/` — privacy related features
- `utility/` — general-purpose utilities

## Authoring

> [!TIP]
> Keep each command focused; prefer one file per command
>
> - Use `libs/logger` for logs
> - Use `libs/database` for data persistence
> - use `libs/scheduler` for scheduled tasks
> - Validate input and handle errors gracefully
