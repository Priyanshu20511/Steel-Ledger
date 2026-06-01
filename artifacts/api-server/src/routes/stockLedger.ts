import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  openingStockTable,
  productionEntriesTable,
  dispatchEntriesTable,
  saleEntriesTable,
  purchaseReturnEntriesTable,
  issueProductionEntriesTable,
} from "@workspace/db";
import { GetStockLedgerQueryParams } from "@workspace/api-zod";
import { authenticate } from "../lib/auth";
import { getOpeningStock, getDayMovementTotals } from "../lib/stockEngine";

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

  const saleDates = await db
    .selectDistinct({ date: saleEntriesTable.date })
    .from(saleEntriesTable)
    .where(
      and(
        eq(saleEntriesTable.stockItemId, stockItemId),
        ...(fromDate ? [sql`${saleEntriesTable.date} >= ${fromDate}`] : []),
        ...(toDate ? [sql`${saleEntriesTable.date} <= ${toDate}`] : []),
      ),
    );

  const purchaseReturnDates = await db
    .selectDistinct({ date: purchaseReturnEntriesTable.date })
    .from(purchaseReturnEntriesTable)
    .where(
      and(
        eq(purchaseReturnEntriesTable.stockItemId, stockItemId),
        ...(fromDate ? [sql`${purchaseReturnEntriesTable.date} >= ${fromDate}`] : []),
        ...(toDate ? [sql`${purchaseReturnEntriesTable.date} <= ${toDate}`] : []),
      ),
    );

  const issueProductionDates = await db
    .selectDistinct({ date: issueProductionEntriesTable.date })
    .from(issueProductionEntriesTable)
    .where(
      and(
        eq(issueProductionEntriesTable.stockItemId, stockItemId),
        ...(fromDate ? [sql`${issueProductionEntriesTable.date} >= ${fromDate}`] : []),
        ...(toDate ? [sql`${issueProductionEntriesTable.date} <= ${toDate}`] : []),
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
    ...saleDates.map((d) => d.date),
    ...purchaseReturnDates.map((d) => d.date),
    ...issueProductionDates.map((d) => d.date),
    ...openDates.map((d) => d.date),
  ])].sort();

  if (allDates.length === 0) {
    res.json([]);
    return;
  }

  const rows = await Promise.all(
    allDates.map(async (date) => {
      const openingStock = await getOpeningStock(stockItemId, date as string);

      const movements = await getDayMovementTotals(stockItemId, date as string);
      const production = movements.production;
      const dispatch = movements.dispatch;
      const closingStock = openingStock + production - dispatch;

      return { date, openingStock, production, dispatch, closingStock };
    }),
  );

  res.json(rows);
});

export default router;
