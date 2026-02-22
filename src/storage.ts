import { promises as fs } from "fs";
import path from "path";

export type UserStats = {
  id: number;
  firstName?: string;
  username?: string;
  language?: string;
  starts: number;
  messages: number;
  lastSeen?: string;
};

export type Db = {
  users: Record<string, UserStats>;
};

const DEFAULT_DB: Db = { users: {} };
const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "db.json");

let writeQueue: Promise<void> = Promise.resolve();

async function ensureDbFile(): Promise<void> {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

export async function readDb(): Promise<Db> {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, "utf8");
  try {
    return JSON.parse(raw) as Db;
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    return { ...DEFAULT_DB };
  }
}

export function updateDb<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  let result: T;
  writeQueue = writeQueue.then(async () => {
    const db = await readDb();
    result = await fn(db);
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
  });

  return writeQueue.then(() => result);
}

export function getUserId(userId: number): string {
  return String(userId);
}

export function upsertUser(db: Db, data: Partial<UserStats> & { id: number }): UserStats {
  const id = getUserId(data.id);
  const current = db.users[id] ?? {
    id: data.id,
    starts: 0,
    messages: 0
  };

  const updated: UserStats = {
    ...current,
    ...data
  };

  db.users[id] = updated;
  return updated;
}
