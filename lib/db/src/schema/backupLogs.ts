import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const backupStatusEnum = pgEnum("backup_status", ["success", "failed", "in_progress"]);

export const backupLogsTable = pgTable("backup_logs", {
  id: serial("id").primaryKey(),
  status: backupStatusEnum("status").notNull().default("in_progress"),
  filename: text("filename"),
  sizeBytes: integer("size_bytes"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BackupLog = typeof backupLogsTable.$inferSelect;
