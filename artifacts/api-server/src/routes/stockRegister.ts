import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, stockMasterTable, openingStockTable, productionEntriesTable, dispatchEntriesTable } from "@workspace/db";
import { GetStockRegisterQueryParams } from "@workspace/api-zod";
import { authenticate } from "../lib/auth";
import { getOpeningStock } from "../lib/stockEngine";

const router = Router();

router.get("/stock-register", authenticate, async (req, res): Promise<void> => {
  const params = GetStockRegisterQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { date: dateParam, category, size, length } = params.data;
  const date = dateParam ?? new Date().toISOString().slice(0, 10);

  // Get all active stock items
  const conditions = [eq(stockMasterTable.status, "active")];
  if (category) conditions.push(eq(stockMasterTable.category, category));
  if (size) conditions.push(eq(stockMasterTable.size, size));
  if (length) conditions.push(eq(stockMasterTable.length, length));

  const items = await db
    .select()
    .from(stockMasterTable)
    .where(and(...conditions))
    .orderBy(stockMasterTable.category, stockMasterTable.size, stockMasterTable.length);

  // For each item, compute stock register row
  const rows = await Promise.all(
    items.map(async (item) => {
      const openingStock = await getOpeningStock(item.id, date);

      const [prodResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${productionEntriesTable.quantity}), 0)` })
        .from(productionEntriesTable)
        .where(and(eq(productionEntriesTable.stockItemId, item.id), sql`${productionEntriesTable.date} = ${date}`));

      const [dispResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${dispatchEntriesTable.quantity}), 0)` })
        .from(dispatchEntriesTable)
        .where(and(eq(dispatchEntriesTable.stockItemId, item.id), sql`${dispatchEntriesTable.date} = ${date}`));

      const production = parseFloat(prodResult?.total ?? "0");
      const dispatch = parseFloat(dispResult?.total ?? "0");
      const closingStock = openingStock + production - dispatch;

      return {
        stockItemId: item.id,
        itemCode: item.itemCode,
        category: item.category,
        size: item.size,
        length: item.length,
        unit: item.unit,
        openingStock,
        production,
        dispatch,
        closingStock,
      };
    }),
  );

  res.json(rows);
});

export default router;
