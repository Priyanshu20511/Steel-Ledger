import { Router } from "express";
import { eq, and, sql, asc } from "drizzle-orm";
import { db, stockMasterTable, openingStockTable, productionEntriesTable, dispatchEntriesTable } from "@workspace/db";
import { GetStockLedgerQueryParams } from "@workspace/api-zod";
import { authenticate } from "../lib/auth";
import { getOpeningStock } from "../lib/stockEngine";

const router = Router();

router.get("/stock-ledger", authenticate, async (req, res): Promise<void> => {
  const params = GetStockLedgerQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { stockItemId, fromDate, toDate } = params.data;
  if (!stockItemId) {
    res.status(400).json({ error: "stockItemId is required" });
    return;
  }

  // Get all distinct dates that have transactions for this item
  const prodDates = await db
    .selectDistinct({ date: productionEntriesTable.date })
    .from(productionEntriesTable)
    .where(
      and(
        eq(productionEntriesTable.stockItemId, stockItemId),
        ...(fromDate ? [sql`${productionEntriesTable.date} >= ${fromDate}`] : []),
        ...(toDate ? [sql`${productionEntriesTable.date} <= ${toDate}`] : []),
      ),
    );

  const dispDates = await db
    .selectDistinct({ date: dispatchEntriesTable.date })
    .from(dispatchEntriesTable)
    .where(
      and(
        eq(dispatchEntriesTable.stockItemId, stockItemId),
        ...(fromDate ? [sql`${dispatchEntriesTable.date} >= ${fromDate}`] : []),
        ...(toDate ? [sql`${dispatchEntriesTable.date} <= ${toDate}`] : []),
      ),
    );

  // Also include opening stock dates
  const openDates = await db
    .selectDistinct({ date: openingStockTable.effectiveDate })
    .from(openingStockTable)
    .where(
      and(
        eq(openingStockTable.stockItemId, stockItemId),
        ...(fromDate ? [sql`${openingStockTable.effectiveDate} >= ${fromDate}`] : []),
        ...(toDate ? [sql`${openingStockTable.effectiveDate} <= ${toDate}`] : []),
      ),
    );

  const allDates = [...new Set([
    ...prodDates.map((d) => d.date),
    ...dispDates.map((d) => d.date),
    ...openDates.map((d) => d.date),
  ])].sort();

  if (allDates.length === 0) {
    res.json([]);
    return;
  }

  const rows = await Promise.all(
    allDates.map(async (date) => {
      const openingStock = await getOpeningStock(stockItemId, date as string);

      const [prodResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${productionEntriesTable.quantity}), 0)` })
        .from(productionEntriesTable)
        .where(and(eq(productionEntriesTable.stockItemId, stockItemId), sql`${productionEntriesTable.date} = ${date}`));

      const [dispResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${dispatchEntriesTable.quantity}), 0)` })
        .from(dispatchEntriesTable)
        .where(and(eq(dispatchEntriesTable.stockItemId, stockItemId), sql`${dispatchEntriesTable.date} = ${date}`));

      const production = parseFloat(prodResult?.total ?? "0");
      const dispatch = parseFloat(dispResult?.total ?? "0");
      const closingStock = openingStock + production - dispatch;

      return { date, openingStock, production, dispatch, closingStock };
    }),
  );

  res.json(rows);
});

export default router;
