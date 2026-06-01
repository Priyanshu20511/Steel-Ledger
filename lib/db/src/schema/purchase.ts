import { pgTable, serial, integer, numeric, date, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stockMasterTable } from "./stockMaster";
import { usersTable } from "./users";

export const purchaseEntriesTable = pgTable("purchase_entries", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  stockItemId: integer("stock_item_id").notNull().references(() => stockMasterTable.id),
  partyName: text("party_name").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  baseRate: numeric("base_rate", { precision: 14, scale: 3 }),
  remarks: text("remarks"),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  updatedById: integer("updated_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPurchaseSchema = createInsertSchema(purchaseEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type PurchaseEntry = typeof purchaseEntriesTable.$inferSelect;
