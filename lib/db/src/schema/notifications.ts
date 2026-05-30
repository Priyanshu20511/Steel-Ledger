import { pgTable, serial, integer, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const notificationTypeEnum = pgEnum("notification_type", ["low_stock", "backup_failed", "large_dispatch", "info"]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id), // null = broadcast to all
  type: notificationTypeEnum("type").notNull().default("info"),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  metadata: text("metadata"), // JSON string
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
