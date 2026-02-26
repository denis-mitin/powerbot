import { getBot } from "../src/bot";

const bot = getBot();

export default async function webhook(req: any, res: any): Promise<void> {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  const update = req.body;
  if (!update) {
    res.status(200).send("ok");
    return;
  }

  await bot.handleUpdate(update, res);
  if (!res.writableEnded) {
    res.status(200).send("ok");
  }
}
