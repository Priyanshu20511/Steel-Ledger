import { pgTable, serial, integer, numeric, date, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stockMasterTable } from "./stockMaster";
import { usersTable } from "./users";

export const purchaseReturnEntriesTable = pgTable("purchase_return_entries", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  stockItemId: integer("stock_item_id").notNull().references(() => stockMasterTable.id),
  partyName: text("party_name").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  baseRate: numeric("base_rate", { precision: 14, scale: 3 }),
  invoiceNumber: text("invoice_number"),
  vehicleNumber: text("vehicle_number"),
  remarks: text("remarks"),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  updatedById: integer("updated_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPurchaseReturnSchema = createInsertSchema(purchaseReturnEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseReturn = z.infer<typeof insertPurchaseReturnSchema>;
export type PurchaseReturnEntry = typeof purchaseReturnEntriesTable.$inferSelect;
