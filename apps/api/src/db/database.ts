import Database from "better-sqlite3";

export type AppDatabase = Database.Database;

export function createDatabase(path: string): AppDatabase {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
