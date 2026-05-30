import { pgTable, serial, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { stockMasterTable } from "./stockMaster";

export const openingStockTable = pgTable("opening_stock", {
  id: serial("id").primaryKey(),
  stockItemId: integer("stock_item_id").notNull().references(() => stockMasterTable.id),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull().default("0"),
  effectiveDate: date("effective_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOpeningStockSchema = createInsertSchema(openingStockTable).omit({ id: true, createdAt: true });
export type InsertOpeningStock = z.infer<typeof insertOpeningStockSchema>;
export type OpeningStock = typeof openingStockTable.$inferSelect;
