import { Database } from "bun:sqlite";
import fs from "fs";
import os from "os";
import path from "path";
import { applyMigrations } from "./migrations";

export interface SQLiteStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SQLiteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SQLiteStatement;
  pragma(query: string, options?: { simple?: boolean }): unknown;
  transaction<T>(fn: () => T): () => T;
  close(): void;
}

let db: SQLiteDatabase | null = null;

export function getDatabasePath(): string {
  const dir = path.join(os.homedir(), ".ollama-cli");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return path.join(dir, "ollama-cli.db");
}

export function getDatabase(): SQLiteDatabase {
  if (db) return db;

  const database = new NodeSqliteDatabase(getDatabasePath());
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.pragma("synchronous = NORMAL");
  applyMigrations(database);
  db = database;
  return database;
}

export function withTransaction<T>(fn: (database: SQLiteDatabase) => T): T {
  const database = getDatabase();
  return database.transaction(() => fn(database))();
}

export function closeDatabase(): void {
  db?.close();
  db = null;
}

class NodeSqliteDatabase implements SQLiteDatabase {
  private readonly db: Database;

  constructor(filename: string) {
    this.db = new Database(filename);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): SQLiteStatement {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params: unknown[]) => {
        const p = flattenParams(params);
        // biome-ignore lint/suspicious/noExplicitAny: bun:sqlite Statement uses unknown param types
        return p !== undefined ? stmt.run(...(p as any[])) : stmt.run();
      },
      get: (...params: unknown[]) => {
        const p = flattenParams(params);
        // biome-ignore lint/suspicious/noExplicitAny: bun:sqlite Statement uses unknown param types
        return p !== undefined ? stmt.get(...(p as any[])) : stmt.get();
      },
      all: (...params: unknown[]) => {
        const p = flattenParams(params);
        // biome-ignore lint/suspicious/noExplicitAny: bun:sqlite Statement uses unknown param types
        return p !== undefined ? (stmt.all(...(p as any[])) as unknown[]) : (stmt.all() as unknown[]);
      },
    };
  }

  pragma(query: string, options?: { simple?: boolean }): unknown {
    if (query.includes("=")) {
      this.db.exec(`PRAGMA ${query}`);
      return undefined;
    }
    const row = this.db.prepare(`PRAGMA ${query}`).get() as Record<string, unknown> | undefined;
    if (!options?.simple) return row;
    if (!row) return undefined;
    return Object.values(row)[0];
  }

  transaction<T>(fn: () => T): () => T {
    return () => {
      this.db.exec("BEGIN");
      try {
        const result = fn();
        this.db.exec("COMMIT");
        return result;
      } catch (err) {
        this.db.exec("ROLLBACK");
        throw err;
      }
    };
  }

  close(): void {
    this.db.close();
  }
}

function flattenParams(params: unknown[]): unknown[] | undefined {
  if (params.length === 0) return undefined;
  if (params.length === 1) {
    // If it's an object (named params) or primitive, pass directly
    const first = params[0];
    if (first === null || first === undefined) return undefined;
    if (Array.isArray(first)) return first;
    if (typeof first === "object") return [first];
    return [first];
  }
  return params;
}
