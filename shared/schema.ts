import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Sessions ────────────────────────────────────────────────
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  query: text("query").notNull(),
  files: text("files").notNull().default("[]"),
  selectedModels: text("selected_models").notNull().default("[]"),
  status: text("status").notNull().default("pending"), // pending | running | completed | error | quick
  currentIteration: integer("current_iteration").notNull().default(0),
  totalIterations: integer("total_iterations").notNull().default(15),
  finalAnswer: text("final_answer"),
  quickAnswer: text("quick_answer"),  // for simple-query fast path
  workflowId: text("workflow_id"),
  isPinned: integer("is_pinned").notNull().default(0),
  followUps: text("follow_ups").notNull().default("[]"), // JSON: [{query, answer, createdAt}]
  debates: text("debates").notNull().default("[]"),     // JSON: [{sessionId, query, createdAt}]
  createdAt: integer("created_at").notNull(),
});
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// ─── Iterations ──────────────────────────────────────────────
export const iterations = sqliteTable("iterations", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  iterationNumber: integer("iteration_number").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  summary: text("summary"),
  consensus: real("consensus"),
  createdAt: integer("created_at").notNull(),
});
export const insertIterationSchema = createInsertSchema(iterations).omit({ id: true, createdAt: true });
export type InsertIteration = z.infer<typeof insertIterationSchema>;
export type Iteration = typeof iterations.$inferSelect;

// ─── Settings ────────────────────────────────────────────────
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
export const insertSettingSchema = createInsertSchema(settings);
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// ─── API Keys ────────────────────────────────────────────────
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  isPrimary: integer("is_primary").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, createdAt: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// ─── Workflows ───────────────────────────────────────────────
export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  steps: text("steps").notNull().default("[]"), // JSON: [{modelId, label, systemPrompt}]
  iterations: integer("iterations").notNull().default(15),
  temperature: real("temperature").notNull().default(0.7),
  consensusThreshold: real("consensus_threshold").notNull().default(0.7), // 0-1
  isDefault: integer("is_default").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
export const insertWorkflowSchema = createInsertSchema(workflows).omit({ id: true, createdAt: true });
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;
