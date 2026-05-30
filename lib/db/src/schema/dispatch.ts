import { pgTable, serial, integer, numeric, date, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stockMasterTable } from "./stockMaster";
import { usersTable } from "./users";

export const dispatchEntriesTable = pgTable("dispatch_entries", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  stockItemId: integer("stock_item_id").notNull().references(() => stockMasterTable.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  partyName: text("party_name").notNull(),
  invoiceNumber: text("invoice_number"),
  vehicleNumber: text("vehicle_number"),
  remarks: text("remarks"),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  updatedById: integer("updated_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDispatchSchema = createInsertSchema(dispatchEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDispatch = z.infer<typeof insertDispatchSchema>;
export type DispatchEntry = typeof dispatchEntriesTable.$inferSelect;
