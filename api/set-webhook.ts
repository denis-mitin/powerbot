import { getBot } from "../src/bot";

const bot = getBot();

export default async function setWebhook(req: any, res: any): Promise<void> {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).send("Method not allowed");
    return;
  }

  const baseUrl =
    process.env.WEBHOOK_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!baseUrl) {
    res
      .status(500)
      .send("WEBHOOK_URL or VERCEL_URL is required to set webhook.");
    return;
  }

  const webhookUrl = `${baseUrl}/api/webhook`;
  await bot.telegram.setWebhook(webhookUrl);
  res.status(200).send(`Webhook set to ${webhookUrl}`);
}
