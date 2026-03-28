import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";
import {
  sessions, iterations, settings, workflows,
  type Session, type Iteration, type Setting, type Workflow,
  type InsertSession, type InsertIteration, type InsertSetting, type InsertWorkflow,
} from "@shared/schema";
import { randomUUID } from "crypto";

const DB_PATH = process.env.DB_PATH ?? "mercury.db";
const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite);

// ─── DDL ─────────────────────────────────────────────────────
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
    quick_answer TEXT,
    workflow_id TEXT,
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

  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    steps TEXT NOT NULL DEFAULT '[]',
    iterations INTEGER NOT NULL DEFAULT 15,
    temperature REAL NOT NULL DEFAULT 0.7,
    consensus_threshold REAL NOT NULL DEFAULT 0.7,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
`);

// Safe migrations
for (const col of [
  "ALTER TABLE sessions ADD COLUMN workflow_id TEXT;",
  "ALTER TABLE sessions ADD COLUMN quick_answer TEXT;",
  "ALTER TABLE workflows ADD COLUMN temperature REAL NOT NULL DEFAULT 0.7;",
  "ALTER TABLE workflows ADD COLUMN consensus_threshold REAL NOT NULL DEFAULT 0.7;",
]) {
  try { sqlite.exec(col); } catch { /* already exists */ }
}

// ─── Interface ───────────────────────────────────────────────
export interface IStorage {
  createSession(data: InsertSession): Session;
  getSession(id: string): Session | undefined;
  listSessions(): Session[];
  updateSession(id: string, data: Partial<Session>): Session | undefined;
  deleteSession(id: string): void;
  deleteAllSessions(): void;

  createIteration(data: InsertIteration): Iteration;
  getIterationsBySession(sessionId: string): Iteration[];

  getSetting(key: string): Setting | undefined;
  setSetting(key: string, value: string): void;

  createWorkflow(data: InsertWorkflow): Workflow;
  getWorkflow(id: string): Workflow | undefined;
  listWorkflows(): Workflow[];
  updateWorkflow(id: string, data: Partial<Workflow>): Workflow | undefined;
  deleteWorkflow(id: string): void;
}

export const storage: IStorage = {
  createSession(data) {
    const s = { ...data, id: randomUUID(), createdAt: Date.now() };
    db.insert(sessions).values(s as any).run();
    return db.select().from(sessions).where(eq(sessions.id, s.id)).get()!;
  },
  getSession(id) { return db.select().from(sessions).where(eq(sessions.id, id)).get(); },
  listSessions() { return db.select().from(sessions).orderBy(desc(sessions.createdAt)).all(); },
  updateSession(id, data) {
    db.update(sessions).set(data as any).where(eq(sessions.id, id)).run();
    return db.select().from(sessions).where(eq(sessions.id, id)).get();
  },
  deleteSession(id) {
    db.delete(iterations).where(eq(iterations.sessionId, id)).run();
    db.delete(sessions).where(eq(sessions.id, id)).run();
  },
  deleteAllSessions() {
    db.delete(iterations).run();
    db.delete(sessions).run();
  },

  createIteration(data) {
    const it = { ...data, id: randomUUID(), createdAt: Date.now() };
    db.insert(iterations).values(it).run();
    return db.select().from(iterations).where(eq(iterations.id, it.id)).get()!;
  },
  getIterationsBySession(sessionId) {
    return db.select().from(iterations)
      .where(eq(iterations.sessionId, sessionId))
      .orderBy(iterations.iterationNumber)
      .all();
  },

  getSetting(key) { return db.select().from(settings).where(eq(settings.key, key)).get(); },
  setSetting(key, value) {
    const ex = db.select().from(settings).where(eq(settings.key, key)).get();
    if (ex) db.update(settings).set({ value }).where(eq(settings.key, key)).run();
    else db.insert(settings).values({ key, value }).run();
  },

  createWorkflow(data) {
    const wf = { ...data, id: randomUUID(), createdAt: Date.now() };
    db.insert(workflows).values(wf as any).run();
    return db.select().from(workflows).where(eq(workflows.id, wf.id)).get()!;
  },
  getWorkflow(id) { return db.select().from(workflows).where(eq(workflows.id, id)).get(); },
  listWorkflows() { return db.select().from(workflows).orderBy(desc(workflows.createdAt)).all(); },
  updateWorkflow(id, data) {
    db.update(workflows).set(data as any).where(eq(workflows.id, id)).run();
    return db.select().from(workflows).where(eq(workflows.id, id)).get();
  },
  deleteWorkflow(id) { db.delete(workflows).where(eq(workflows.id, id)).run(); },
};
