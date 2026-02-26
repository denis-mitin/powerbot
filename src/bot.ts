import { readFile } from "node:fs/promises";
import path from "node:path";
import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { readDb, updateDb, upsertUser, getUserId } from "./storage";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "odysseus_den";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

type CategoryKey = "inverters" | "batteries" | "bundles";
type ModelData = {
  id: string;
  name: string;
  imageUrl: string;
  description: string;
};

const MODEL_FILES = ["model-1.json", "model-2.json", "model-3.json"];

let botInstance: Telegraf | null = null;

export function getBot(): Telegraf {
  if (botInstance) {
    return botInstance;
  }

  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error("BOT_TOKEN is required. Set it in .env");
  }

  const bot = new Telegraf(token);
  registerHandlers(bot);
  botInstance = bot;
  return bot;
}

async function loadModels(category: CategoryKey): Promise<ModelData[]> {
  const modelsDir = path.join(process.cwd(), "data", category);
  const models = await Promise.all(
    MODEL_FILES.map(async (file) => {
      const raw = await readFile(path.join(modelsDir, file), "utf8");
      return JSON.parse(raw) as ModelData;
    })
  );
  return models;
}

function getDisplayUsername(ctx: Context): string {
  const from = ctx.from;
  if (from?.username) {
    return `@${from.username}`;
  }
  return from?.first_name ?? String(from?.id ?? "unknown");
}

async function getAdminChatId(): Promise<number | null> {
  if (ADMIN_CHAT_ID) {
    const parsed = Number(ADMIN_CHAT_ID);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const db = await readDb();
  const admin = Object.values(db.users).find(
    (user) => user.username === ADMIN_USERNAME
  );
  return admin?.id ?? null;
}

function registerHandlers(bot: Telegraf): void {
  bot.use(async (ctx, next) => {
    const from = ctx.from;
    if (!from) {
      return next();
    }

    await updateDb((db) => {
      const now = new Date().toISOString();
      const user = upsertUser(db, {
        id: from.id,
        firstName: from.first_name,
        username: from.username,
        lastSeen: now
      });

      if ("message" in ctx.update) {
        user.messages += 1;
      }
    });

    return next();
  });

  bot.start(async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }

    await updateDb((db) => {
      const user = upsertUser(db, {
        id: from.id,
        firstName: from.first_name,
        username: from.username,
        lastSeen: new Date().toISOString()
      });

      user.starts += 1;
      return user.starts;
    });

    await ctx.reply(
      `Добрый день, ${from.first_name}! Выберите язык:`,
      Markup.inlineKeyboard([
        Markup.button.callback("Ru", "lang:ru"),
        Markup.button.callback("Ua", "lang:ua")
      ])
    );
  });

  bot.command("count", async (ctx) => {
    const from = ctx.from;
    if (!from) {
      return;
    }

    const db = await readDb();
    const user = db.users[getUserId(from.id)];
    const count = user?.messages ?? 0;
    await ctx.reply(`Messages received from you: ${count}`);
  });

  bot.action(/lang:(ru|ua)/, async (ctx) => {
    const lang = ctx.match[1];
    await updateDb((db) => {
      upsertUser(db, {
        id: ctx.from?.id ?? 0,
        firstName: ctx.from?.first_name,
        username: ctx.from?.username,
        language: lang,
        lastSeen: new Date().toISOString()
      });
    });

    const username =
      ctx.from?.username ??
      ctx.from?.first_name ??
      String(ctx.from?.id ?? "unknown");

    const labels =
      lang === "ru"
        ? ["Инвертеры", "Батареи", "Комплект инвертер + батарея"]
        : ["Інвертори", "Батареї", "Комплект інвертор + батарея"];

    await ctx.answerCbQuery(`Selected ${lang.toUpperCase()}`);
    await ctx.reply(
      lang === "ru" ? "Выберите категорию:" : "Оберіть категорію:",
      Markup.inlineKeyboard([
        Markup.button.callback(labels[0], "menu:inverters"),
        Markup.button.callback(labels[1], "menu:batteries"),
        Markup.button.callback(labels[2], "menu:bundle")
      ])
    );

    // eslint-disable-next-line no-console
    console.log(`username ${username} selected language ${lang}`);
  });

  bot.action("menu:inverters", async (ctx) => {
    const db = await readDb();
    const lang = db.users[getUserId(ctx.from?.id ?? 0)]?.language ?? "ru";

    const username =
      ctx.from?.username ??
      ctx.from?.first_name ??
      String(ctx.from?.id ?? "unknown");

    await ctx.answerCbQuery();
    await ctx.reply(
      lang === "ru" ? "Выберите бренд инвертора:" : "Оберіть бренд інвертора:",
      Markup.inlineKeyboard([
        Markup.button.callback("Deye", "inv:deye"),
        Markup.button.callback("Oukitel", "inv:oukitel"),
        Markup.button.callback("Fossibot", "inv:fossibot")
      ])
    );

    // eslint-disable-next-line no-console
    console.log(`username ${username} selected category inverters`);
  });

  bot.action(/inv:(deye|oukitel|fossibot)/, async (ctx) => {
    const brand = ctx.match[1];
    const username =
      ctx.from?.username ??
      ctx.from?.first_name ??
      String(ctx.from?.id ?? "unknown");

    // eslint-disable-next-line no-console
    console.log(`username ${username} selected category inverters brand ${brand}`);

    await ctx.answerCbQuery(`Selected ${brand}`);
    await ctx.reply(
      "Мощность:",
      Markup.inlineKeyboard([
        Markup.button.callback("5кВт", `power:inverters:${brand}:5kw`),
        Markup.button.callback("6кВт", `power:inverters:${brand}:6kw`),
        Markup.button.callback("8 кВт", `power:inverters:${brand}:8kw`)
      ])
    );
  });

  bot.action("menu:batteries", async (ctx) => {
    const db = await readDb();
    const lang = db.users[getUserId(ctx.from?.id ?? 0)]?.language ?? "ru";

    const username =
      ctx.from?.username ??
      ctx.from?.first_name ??
      String(ctx.from?.id ?? "unknown");

    await ctx.answerCbQuery();
    await ctx.reply(
      lang === "ru" ? "Выберите бренд батареи:" : "Оберіть бренд батареї:",
      Markup.inlineKeyboard([
        Markup.button.callback("Pylontech", "bat:pylontech"),
        Markup.button.callback("Dyness", "bat:dyness"),
        Markup.button.callback("Sofar", "bat:sofar")
      ])
    );

    // eslint-disable-next-line no-console
    console.log(`username ${username} selected category batteries`);
  });

  bot.action("menu:bundle", async (ctx) => {
    const db = await readDb();
    const lang = db.users[getUserId(ctx.from?.id ?? 0)]?.language ?? "ru";

    const username =
      ctx.from?.username ??
      ctx.from?.first_name ??
      String(ctx.from?.id ?? "unknown");

    await ctx.answerCbQuery();
    await ctx.reply(
      lang === "ru"
        ? "Выберите бренд комплекта:"
        : "Оберіть бренд комплекту:",
      Markup.inlineKeyboard([
        Markup.button.callback("Deye + Pylontech", "bun:deye-pylontech"),
        Markup.button.callback("Oukitel + Dyness", "bun:oukitel-dyness"),
        Markup.button.callback("Fossibot + Sofar", "bun:fossibot-sofar")
      ])
    );

    // eslint-disable-next-line no-console
    console.log(`username ${username} selected category bundle`);
  });

  bot.action(/bat:(pylontech|dyness|sofar)/, async (ctx) => {
    const brand = ctx.match[1];
    const username =
      ctx.from?.username ??
      ctx.from?.first_name ??
      String(ctx.from?.id ?? "unknown");

    // eslint-disable-next-line no-console
    console.log(`username ${username} selected category batteries brand ${brand}`);

    await ctx.answerCbQuery(`Selected ${brand}`);
    await ctx.reply(
      "Мощность:",
      Markup.inlineKeyboard([
        Markup.button.callback("5кВт", `power:batteries:${brand}:5kw`),
        Markup.button.callback("6кВт", `power:batteries:${brand}:6kw`),
        Markup.button.callback("8 кВт", `power:batteries:${brand}:8kw`)
      ])
    );
  });

  bot.action(
    /bun:(deye-pylontech|oukitel-dyness|fossibot-sofar)/,
    async (ctx) => {
      const brand = ctx.match[1];
      const username =
        ctx.from?.username ??
        ctx.from?.first_name ??
        String(ctx.from?.id ?? "unknown");

      // eslint-disable-next-line no-console
      console.log(`username ${username} selected category bundle brand ${brand}`);

      await ctx.answerCbQuery(`Selected ${brand}`);
      await ctx.reply(
        "Мощность:",
        Markup.inlineKeyboard([
          Markup.button.callback("5кВт", `power:bundles:${brand}:5kw`),
          Markup.button.callback("6кВт", `power:bundles:${brand}:6kw`),
          Markup.button.callback("8 кВт", `power:bundles:${brand}:8kw`)
        ])
      );
    }
  );

  bot.action(
    /power:(inverters|batteries|bundles):([a-z0-9-]+):(5kw|6kw|8kw)/,
    async (ctx) => {
      const category = ctx.match[1] as CategoryKey;
      const brand = ctx.match[2];
      const power = ctx.match[3];

      await ctx.answerCbQuery(`Selected ${brand} ${power}`);

      try {
        const db = await readDb();
        const lang = db.users[getUserId(ctx.from?.id ?? 0)]?.language ?? "ru";
        const selectLabel = lang === "ru" ? "Выбрать" : "Обрати";
        const models = await loadModels(category);

        for (const model of models) {
          const caption = `${model.name}\n\n${model.description}`;
          await ctx.replyWithPhoto(
            { url: model.imageUrl },
            {
              caption,
              reply_markup: Markup.inlineKeyboard([
                Markup.button.callback(
                  selectLabel,
                  `select:${category}:${brand}:${power}:${model.id}`
                )
              ]).reply_markup
            }
          );
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to load models", error);
        await ctx.reply("Не удалось загрузить модели.");
      }
    }
  );

  bot.action(
    /select:(inverters|batteries|bundles):([a-z0-9-]+):(5kw|6kw|8kw):([a-z0-9-]+)/,
    async (ctx) => {
      const category = ctx.match[1] as CategoryKey;
      const brand = ctx.match[2];
      const power = ctx.match[3];
      const modelId = ctx.match[4];

      const db = await readDb();
      const lang = db.users[getUserId(ctx.from?.id ?? 0)]?.language ?? "ru";
      const username = getDisplayUsername(ctx);
      const models = await loadModels(category);
      const model = models.find((item) => item.id === modelId);

      await ctx.answerCbQuery();
      await ctx.reply(
        lang === "ru"
          ? "Спасибо! Заявка отправлена."
          : "Дякуємо! Заявку надіслано."
      );

      const adminChatId = await getAdminChatId();
      if (!adminChatId) {
        // eslint-disable-next-line no-console
        console.warn("Admin chat id not found for username", ADMIN_USERNAME);
        return;
      }

      const message = [
        "Новый запрос",
        `Language: ${lang}`,
        `Username: ${username}`,
        `Model: ${model?.name ?? modelId}`,
        `Category: ${category}`,
        `Brand: ${brand}`,
        `Power: ${power}`
      ].join("\n");

      try {
        await bot.telegram.sendMessage(adminChatId, message);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to notify admin", error);
      }
    }
  );

  bot.command("stats", async (ctx) => {
    const db = await readDb();
    const users = Object.values(db.users);
    const totalUsers = users.length;
    const totalMessages = users.reduce((sum, user) => sum + user.messages, 0);

    await ctx.reply(
      `Users: ${totalUsers}\nMessages: ${totalMessages}`
    );
  });

  bot.on("text", async (ctx) => {
    await ctx.reply("Send /count or /stats. Use /start to initialize.");
  });
}
