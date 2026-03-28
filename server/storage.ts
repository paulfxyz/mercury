import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";
import { sessions, iterations, settings, type Session, type Iteration, type Setting, type InsertSession, type InsertIteration, type InsertSetting } from "@shared/schema";
import { randomUUID } from "crypto";

const sqlite = new Database("mercury.db");
const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    query TEXT NOT NULL,
    files TEXT NOT NULL DEFAULT '[]',
    selected_models TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    current_iteration INTEGER NOT NULL DEFAULT 0,
    total_iterations INTEGER NOT NULL DEFAULT 15,
    final_answer TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS iterations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    iteration_number INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    consensus REAL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export interface IStorage {
  // Sessions
  createSession(data: InsertSession): Session;
  getSession(id: string): Session | undefined;
  listSessions(): Session[];
  updateSession(id: string, data: Partial<Session>): Session | undefined;
  deleteSession(id: string): void;

  // Iterations
  createIteration(data: InsertIteration): Iteration;
  getIterationsBySession(sessionId: string): Iteration[];

  // Settings
  getSetting(key: string): Setting | undefined;
  setSetting(key: string, value: string): void;
}

export const storage: IStorage = {
  createSession(data) {
    const session = { ...data, id: randomUUID(), createdAt: Date.now() };
    db.insert(sessions).values(session).run();
    return db.select().from(sessions).where(eq(sessions.id, session.id)).get()!;
  },

  getSession(id) {
    return db.select().from(sessions).where(eq(sessions.id, id)).get();
  },

  listSessions() {
    return db.select().from(sessions).orderBy(desc(sessions.createdAt)).all();
  },

  updateSession(id, data) {
    db.update(sessions).set(data).where(eq(sessions.id, id)).run();
    return db.select().from(sessions).where(eq(sessions.id, id)).get();
  },

  deleteSession(id) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
  },

  createIteration(data) {
    const iter = { ...data, id: randomUUID(), createdAt: Date.now() };
    db.insert(iterations).values(iter).run();
    return db.select().from(iterations).where(eq(iterations.id, iter.id)).get()!;
  },

  getIterationsBySession(sessionId) {
    return db.select().from(iterations).where(eq(iterations.sessionId, sessionId)).orderBy(iterations.iterationNumber).all();
  },

  getSetting(key) {
    return db.select().from(settings).where(eq(settings.key, key)).get();
  },

  setSetting(key, value) {
    const existing = db.select().from(settings).where(eq(settings.key, key)).get();
    if (existing) {
      db.update(settings).set({ value }).where(eq(settings.key, key)).run();
    } else {
      db.insert(settings).values({ key, value }).run();
    }
  },
};
