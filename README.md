# Telega Bot (Telegraf + TypeScript)

Simple Telegram bot server using Telegraf and a JSON file for storage.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file and set your token:

```bash
cp .env.example .env
```

3. Run in development:

```bash
npm run dev
```

## Modes

- Polling (default): set only `BOT_TOKEN`.
- Webhook: set `WEBHOOK_URL` (public base URL) and optionally `WEBHOOK_PATH`.

## Commands

- `/start` increments a start counter per user.
- `/count` returns the number of messages seen from you.
- `/stats` returns total users and messages.

## Storage

Data is stored in `data/db.json` (configurable via `DB_PATH`).
