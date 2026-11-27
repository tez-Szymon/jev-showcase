import "server-only";
import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defaults } from "./domain";
import { env } from "./env";
import { initializeSchema } from "./migrations";
export function openDatabase(path: string) {
  if (path !== ":memory:")
    mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  initializeSchema(db, readFileSync(resolve("src/lib/schema.sql"), "utf8"));
  db.prepare("INSERT OR IGNORE INTO settings VALUES (1, 1, ?, ?)").run(
    JSON.stringify(defaults),
    new Date().toISOString(),
  );
  return db;
}
const globalDb = globalThis as unknown as { demoDb?: Database.Database };
export function getDb() {
  return (globalDb.demoDb ??= openDatabase(env().databasePath));
}
