import { pgTable, text, serial, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const itemStatusEnum = pgEnum("item_status", ["active", "inactive"]);

export const stockMasterTable = pgTable("stock_master", {
  id: serial("id").primaryKey(),
  itemCode: text("item_code").notNull().unique(),
  category: text("category").notNull(),
  size: text("size").notNull(),
  length: text("length").notNull(),
  unit: text("unit").notNull().default("NOS"),
  status: itemStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStockMasterSchema = createInsertSchema(stockMasterTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStockMaster = z.infer<typeof insertStockMasterSchema>;
export type StockMaster = typeof stockMasterTable.$inferSelect;
