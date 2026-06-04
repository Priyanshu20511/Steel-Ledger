import {
  db,
  openingStockTable,
  productionEntriesTable,
  purchaseEntriesTable,
  saleReturnEntriesTable,
  dispatchEntriesTable,
  saleEntriesTable,
  purchaseReturnEntriesTable,
  issueProductionEntriesTable,
} from "@workspace/db";
import { eq, lte, lt, and, sql, sum } from "drizzle-orm";

type MovementTotals = {
  production: number;
  purchase: number;
  saleReturn: number;
  sale: number;
  purchaseReturn: number;
  issueProduction: number;
  dispatch: number;
};

async function sumBeforeDate(
  table: any,
  stockItemId: number,
  baseDate: string,
  date: string,
) {
  const [result] = await db
    .select({ total: sum(table.quantity) })
    .from(table)
    .where(
      and(
        eq(table.stockItemId, stockItemId),
        sql`${table.date} > ${baseDate}`,
        lt(table.date, date),
      ),
    );
  return parseFloat((result?.total as string) ?? "0") || 0;
}

async function sumOnDate(table: any, stockItemId: number, date: string) {
  const [result] = await db
    .select({ total: sum(table.quantity) })
    .from(table)
    .where(
      and(eq(table.stockItemId, stockItemId), sql`${table.date} = ${date}`),
    );
  return parseFloat((result?.total as string) ?? "0") || 0;
}

async function sumInRange(
  table: any,
  stockItemId: number,
  fromDate: string,
  toDate: string,
) {
  const [result] = await db
    .select({ total: sum(table.quantity) })
    .from(table)
    .where(
      and(
        eq(table.stockItemId, stockItemId),
        sql`${table.date} >= ${fromDate}`,
        sql`${table.date} <= ${toDate}`,
      ),
    );
  return parseFloat((result?.total as string) ?? "0") || 0;
}

export async function getDayMovementTotals(
  stockItemId: number,
  date: string,
): Promise<MovementTotals> {
  const production = await sumOnDate(productionEntriesTable, stockItemId, date);
  const purchase = await sumOnDate(purchaseEntriesTable, stockItemId, date);
  const saleReturn = await sumOnDate(saleReturnEntriesTable, stockItemId, date);
  const sale = await sumOnDate(saleEntriesTable, stockItemId, date);
  const purchaseReturn = await sumOnDate(
    purchaseReturnEntriesTable,
    stockItemId,
    date,
  );
  const issueProduction = await sumOnDate(
    issueProductionEntriesTable,
    stockItemId,
    date,
  );
  const dispatch = await sumOnDate(dispatchEntriesTable, stockItemId, date);

  return {
    production,
    purchase,
    saleReturn,
    sale,
    purchaseReturn,
    issueProduction,
    dispatch: dispatch + sale + purchaseReturn + issueProduction,
  };
}

export async function getRangeMovementTotals(
  stockItemId: number,
  fromDate: string,
  toDate: string,
): Promise<MovementTotals> {
  const production = await sumInRange(
    productionEntriesTable,
    stockItemId,
    fromDate,
    toDate,
  );
  const purchase = await sumInRange(
    purchaseEntriesTable,
    stockItemId,
    fromDate,
    toDate,
  );
  const saleReturn = await sumInRange(
    saleReturnEntriesTable,
    stockItemId,
    fromDate,
    toDate,
  );
  const sale = await sumInRange(
    saleEntriesTable,
    stockItemId,
    fromDate,
    toDate,
  );
  const purchaseReturn = await sumInRange(
    purchaseReturnEntriesTable,
    stockItemId,
    fromDate,
    toDate,
  );
  const issueProduction = await sumInRange(
    issueProductionEntriesTable,
    stockItemId,
    fromDate,
    toDate,
  );
  const dispatch = await sumInRange(
    dispatchEntriesTable,
    stockItemId,
    fromDate,
    toDate,
  );

  return {
    production,
    purchase,
    saleReturn,
    sale,
    purchaseReturn,
    issueProduction,
    dispatch: dispatch + sale + purchaseReturn + issueProduction,
  };
}

/**
 * Calculate the opening stock for a given item on a given date.
 * Opening = base opening stock + all stock-in before date - all stock-out before date
 */
export async function getOpeningStock(
  stockItemId: number,
  date: string,
): Promise<number> {
  // Get the most recent opening stock entry on or before this date
  const [baseEntry] = await db
    .select()
    .from(openingStockTable)
    .where(
      and(
        eq(openingStockTable.stockItemId, stockItemId),
        lte(openingStockTable.effectiveDate, date),
      ),
    )
    .orderBy(sql`${openingStockTable.effectiveDate} DESC`)
    .limit(1);

  if (!baseEntry) return 0;

  const baseQty = parseFloat(baseEntry.quantity as string);
  const baseDate = baseEntry.effectiveDate;

  const production = await sumBeforeDate(
    productionEntriesTable,
    stockItemId,
    baseDate,
    date,
  );
  const purchase = await sumBeforeDate(
    purchaseEntriesTable,
    stockItemId,
    baseDate,
    date,
  );
  const saleReturn = await sumBeforeDate(
    saleReturnEntriesTable,
    stockItemId,
    baseDate,
    date,
  );
  const sale = await sumBeforeDate(
    saleEntriesTable,
    stockItemId,
    baseDate,
    date,
  );
  const purchaseReturn = await sumBeforeDate(
    purchaseReturnEntriesTable,
    stockItemId,
    baseDate,
    date,
  );
  const issueProduction = await sumBeforeDate(
    issueProductionEntriesTable,
    stockItemId,
    baseDate,
    date,
  );
  const dispatch = await sumBeforeDate(
    dispatchEntriesTable,
    stockItemId,
    baseDate,
    date,
  );

  return (
    baseQty +
    production +
    purchase +
    saleReturn -
    sale -
    purchaseReturn -
    issueProduction -
    dispatch
  );
}

/**
 * Calculate stock register row for a given item and date.
 */
export async function getStockRegisterRow(
  stockItemId: number,
  date: string,
): Promise<{
  openingStock: number;
  production: number;
  purchase: number;
  saleReturn: number;
  sale: number;
  purchaseReturn: number;
  issueProduction: number;
  dispatch: number;
  closingStock: number;
}> {
  const openingStock = await getOpeningStock(stockItemId, date);
  const totals = await getDayMovementTotals(stockItemId, date);
  const closingStock =
    openingStock +
    totals.production +
    totals.purchase +
    totals.saleReturn -
    totals.dispatch;

  const stockIn = totals.production + totals.purchase + totals.saleReturn;

  return {
    openingStock,
    production: stockIn, // use Production column as Stock In
    purchase: totals.purchase,
    saleReturn: totals.saleReturn,
    sale: totals.sale,
    purchaseReturn: totals.purchaseReturn,
    issueProduction: totals.issueProduction,
    dispatch: totals.dispatch,
    closingStock,
  };
}
