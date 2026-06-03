import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const partyMasterTable = pgTable("party_master", {
  id: serial("id").primaryKey(),

  name: text("name").notNull(),

  gstNo: text("gst_no"),

  phone: text("phone"),

  address: text("address"),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPartyMasterSchema = createInsertSchema(
  partyMasterTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPartyMaster = z.infer<typeof insertPartyMasterSchema>;

export type PartyMaster = typeof partyMasterTable.$inferSelect;
