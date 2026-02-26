import { getBot } from "../src/bot";

const bot = getBot();

async function readUpdate(req: any): Promise<any | null> {
  if (req.body) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return null;
      }
    }
    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString("utf8"));
      } catch {
        return null;
      }
    }
    return req.body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return null;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

export default async function webhook(req: any, res: any): Promise<void> {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  const update = await readUpdate(req);
  if (!update) {
    res.status(200).send("ok");
    return;
  }

  try {
    await bot.handleUpdate(update);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to handle update", error);
  }

  res.status(200).send("ok");
}
