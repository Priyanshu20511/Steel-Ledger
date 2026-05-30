import { db, openingStockTable, productionEntriesTable, dispatchEntriesTable } from "@workspace/db";
import { eq, lte, lt, and, sql, sum } from "drizzle-orm";

/**
 * Calculate the opening stock for a given item on a given date.
 * Opening = base opening stock + all production before date - all dispatch before date
 */
export async function getOpeningStock(stockItemId: number, date: string): Promise<number> {
  // Get the most recent opening stock entry on or before this date
  const [baseEntry] = await db
    .select()
    .from(openingStockTable)
    .where(and(eq(openingStockTable.stockItemId, stockItemId), lte(openingStockTable.effectiveDate, date)))
    .orderBy(sql`${openingStockTable.effectiveDate} DESC`)
    .limit(1);

  if (!baseEntry) return 0;

  const baseQty = parseFloat(baseEntry.quantity as string);
  const baseDate = baseEntry.effectiveDate;

  // Sum all production AFTER base date and BEFORE (exclusive) the given date
  const [prodResult] = await db
    .select({ total: sum(productionEntriesTable.quantity) })
    .from(productionEntriesTable)
    .where(
      and(
        eq(productionEntriesTable.stockItemId, stockItemId),
        sql`${productionEntriesTable.date} > ${baseDate}`,
        lt(productionEntriesTable.date, date),
      ),
    );

  // Sum all dispatch AFTER base date and BEFORE (exclusive) the given date
  const [dispResult] = await db
    .select({ total: sum(dispatchEntriesTable.quantity) })
    .from(dispatchEntriesTable)
    .where(
      and(
        eq(dispatchEntriesTable.stockItemId, stockItemId),
        sql`${dispatchEntriesTable.date} > ${baseDate}`,
        lt(dispatchEntriesTable.date, date),
      ),
    );

  const production = parseFloat((prodResult?.total as string) ?? "0") || 0;
  const dispatch = parseFloat((dispResult?.total as string) ?? "0") || 0;

  return baseQty + production - dispatch;
}

/**
 * Calculate stock register row for a given item and date.
 */
export async function getStockRegisterRow(
  stockItemId: number,
  date: string,
): Promise<{ openingStock: number; production: number; dispatch: number; closingStock: number }> {
  const openingStock = await getOpeningStock(stockItemId, date);

  const [prodResult] = await db
    .select({ total: sum(productionEntriesTable.quantity) })
    .from(productionEntriesTable)
    .where(
      and(
        eq(productionEntriesTable.stockItemId, stockItemId),
        sql`${productionEntriesTable.date} = ${date}`,
      ),
    );

  const [dispResult] = await db
    .select({ total: sum(dispatchEntriesTable.quantity) })
    .from(dispatchEntriesTable)
    .where(
      and(
        eq(dispatchEntriesTable.stockItemId, stockItemId),
        sql`${dispatchEntriesTable.date} = ${date}`,
      ),
    );

  const production = parseFloat((prodResult?.total as string) ?? "0") || 0;
  const dispatch = parseFloat((dispResult?.total as string) ?? "0") || 0;
  const closingStock = openingStock + production - dispatch;

  return { openingStock, production, dispatch, closingStock };
}
