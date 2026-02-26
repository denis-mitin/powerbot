import "dotenv/config";
import express from "express";
import { getBot } from "./bot";

const PORT = Number(process.env.PORT ?? 3000);
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_PATH = process.env.WEBHOOK_PATH ?? "/webhook";

const bot = getBot();
const app = express();

app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

async function start(): Promise<void> {
  if (WEBHOOK_URL) {
    app.use(express.json());
    app.use(WEBHOOK_PATH, bot.webhookCallback(WEBHOOK_PATH));
    await bot.telegram.setWebhook(`${WEBHOOK_URL}${WEBHOOK_PATH}`);
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Webhook server listening on :${PORT}${WEBHOOK_PATH}`);
    });
  } else {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server listening on :${PORT}`);
    });
    await bot.launch();
  }

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

void start();
