import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sessions table
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  query: text("query").notNull(),
  files: text("files").notNull().default("[]"), // JSON array of file names
  selectedModels: text("selected_models").notNull().default("[]"), // JSON array
  status: text("status").notNull().default("pending"), // pending | running | completed | error
  currentIteration: integer("current_iteration").notNull().default(0),
  totalIterations: integer("total_iterations").notNull().default(15),
  finalAnswer: text("final_answer"),
  createdAt: integer("created_at").notNull(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// Iterations table
export const iterations = sqliteTable("iterations", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  iterationNumber: integer("iteration_number").notNull(),
  type: text("type").notNull(), // research | debate | vote | synthesis | final
  content: text("content").notNull(), // JSON with model responses
  summary: text("summary"),
  consensus: real("consensus"), // 0-1 agreement score
  createdAt: integer("created_at").notNull(),
});

export const insertIterationSchema = createInsertSchema(iterations).omit({ id: true, createdAt: true });
export type InsertIteration = z.infer<typeof insertIterationSchema>;
export type Iteration = typeof iterations.$inferSelect;

// API Key settings
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const insertSettingSchema = createInsertSchema(settings);
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;
