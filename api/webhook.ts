import { getBot } from "../src/bot";

const bot = getBot();
const handler = bot.webhookCallback("/api/webhook");

export default async function webhook(req: any, res: any): Promise<void> {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  await handler(req, res);
}
