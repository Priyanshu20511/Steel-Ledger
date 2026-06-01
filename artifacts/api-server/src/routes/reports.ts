import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  stockMasterTable,
  productionEntriesTable,
  dispatchEntriesTable,
  saleEntriesTable,
  purchaseReturnEntriesTable,
  issueProductionEntriesTable,
} from "@workspace/db";
import {
  GetDailyReportQueryParams,
  GetMonthlyReportQueryParams,
  GetCategoryReportQueryParams,
  GetProductionSummaryReportQueryParams,
  GetDispatchSummaryReportQueryParams,
} from "@workspace/api-zod";
import { authenticate } from "../lib/auth";
import { getOpeningStock, getDayMovementTotals, getRangeMovementTotals } from "../lib/stockEngine";

const router = Router();

const toDateString = (value: string | Date) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;

router.get("/reports/daily", authenticate, async (req, res): Promise<void> => {
  const params = GetDailyReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { date } = params.data;
  if (!date) {
    res.status(400).json({ error: "date is required" });
    return;
  }
  const reportDate = toDateString(date);

  const items = await db
    .select()
    .from(stockMasterTable)
    .where(eq(stockMasterTable.status, "active"))
    .orderBy(stockMasterTable.category, stockMasterTable.size);

  let totalProduction = 0;
  let totalDispatch = 0;

  const rows = await Promise.all(
    items.map(async (item) => {
      const openingStock = await getOpeningStock(item.id, reportDate);
      const movements = await getDayMovementTotals(item.id, reportDate);
      const production = movements.production;
      const dispatch = movements.dispatch;
      totalProduction += production;
      totalDispatch += dispatch;
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
        closingStock: openingStock + production - dispatch,
      };
    }),
  );

  res.json({ date: reportDate, rows, totalProduction, totalDispatch });
});

router.get("/reports/monthly", authenticate, async (req, res): Promise<void> => {
  const params = GetMonthlyReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { month, year } = params.data;
  if (!month || !year) {
    res.status(400).json({ error: "month and year are required" });
    return;
  }

  const monthStr = String(month).padStart(2, "0");
  const start = `${year}-${monthStr}-01`;
  const endDate = new Date(Number(year), Number(month), 0);
  const end = endDate.toISOString().slice(0, 10);

  // Get all dates in this month that have data
  const prodDates = await db
    .selectDistinct({ date: productionEntriesTable.date })
    .from(productionEntriesTable)
    .where(
      and(
        sql`${productionEntriesTable.date} >= ${start}`,
        sql`${productionEntriesTable.date} <= ${end}`,
      ),
    );
  const dispDates = await db
    .selectDistinct({ date: dispatchEntriesTable.date })
    .from(dispatchEntriesTable)
    .where(
      and(
        sql`${dispatchEntriesTable.date} >= ${start}`,
        sql`${dispatchEntriesTable.date} <= ${end}`,
      ),
    );
  const saleDates = await db
    .selectDistinct({ date: saleEntriesTable.date })
    .from(saleEntriesTable)
    .where(
      and(
        sql`${saleEntriesTable.date} >= ${start}`,
        sql`${saleEntriesTable.date} <= ${end}`,
      ),
    );
  const purchaseReturnDates = await db
    .selectDistinct({ date: purchaseReturnEntriesTable.date })
    .from(purchaseReturnEntriesTable)
    .where(
      and(
        sql`${purchaseReturnEntriesTable.date} >= ${start}`,
        sql`${purchaseReturnEntriesTable.date} <= ${end}`,
      ),
    );
  const issueProductionDates = await db
    .selectDistinct({ date: issueProductionEntriesTable.date })
    .from(issueProductionEntriesTable)
    .where(
      and(
        sql`${issueProductionEntriesTable.date} >= ${start}`,
        sql`${issueProductionEntriesTable.date} <= ${end}`,
      ),
    );

  const allDates = [...new Set([
    ...prodDates.map((d) => d.date),
    ...dispDates.map((d) => d.date),
    ...saleDates.map((d) => d.date),
    ...purchaseReturnDates.map((d) => d.date),
    ...issueProductionDates.map((d) => d.date),
  ])].sort();

  let totalProduction = 0;
  let totalDispatch = 0;

  const rows = await Promise.all(
    allDates.map(async (date) => {
      const [prodResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${productionEntriesTable.quantity}), 0)` })
        .from(productionEntriesTable)
        .where(sql`${productionEntriesTable.date} = ${date}`);
      const [dispResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${dispatchEntriesTable.quantity}), 0)` })
        .from(dispatchEntriesTable)
        .where(sql`${dispatchEntriesTable.date} = ${date}`);
      const [saleResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${saleEntriesTable.quantity}), 0)` })
        .from(saleEntriesTable)
        .where(sql`${saleEntriesTable.date} = ${date}`);
      const [purchaseReturnResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${purchaseReturnEntriesTable.quantity}), 0)` })
        .from(purchaseReturnEntriesTable)
        .where(sql`${purchaseReturnEntriesTable.date} = ${date}`);
      const [issueProductionResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${issueProductionEntriesTable.quantity}), 0)` })
        .from(issueProductionEntriesTable)
        .where(sql`${issueProductionEntriesTable.date} = ${date}`);
      const production = parseFloat(prodResult?.total ?? "0");
      const dispatch =
        parseFloat(dispResult?.total ?? "0") +
        parseFloat(saleResult?.total ?? "0") +
        parseFloat(purchaseReturnResult?.total ?? "0") +
        parseFloat(issueProductionResult?.total ?? "0");
      totalProduction += production;
      totalDispatch += dispatch;
      return { date, production, dispatch };
    }),
  );

  res.json({ month, year, rows, totalProduction, totalDispatch });
});

router.get("/reports/category", authenticate, async (req, res): Promise<void> => {
  const params = GetCategoryReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { fromDate, toDate } = params.data;
  if (!fromDate || !toDate) {
    res.status(400).json({ error: "fromDate and toDate are required" });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const items = await db.select().from(stockMasterTable).where(eq(stockMasterTable.status, "active"));
  const categoryMap: Record<string, { totalProduction: number; totalDispatch: number; closingStock: number }> = {};
  const from = toDateString(fromDate);
  const to = toDateString(toDate);

  for (const item of items) {
    const rangeMovements = await getRangeMovementTotals(item.id, from, to);

    const opening = await getOpeningStock(item.id, today);
    const todayMovements = await getDayMovementTotals(item.id, today);
    const closing = opening + todayMovements.production - todayMovements.dispatch;

    if (!categoryMap[item.category]) {
      categoryMap[item.category] = { totalProduction: 0, totalDispatch: 0, closingStock: 0 };
    }
    categoryMap[item.category].totalProduction += rangeMovements.production;
    categoryMap[item.category].totalDispatch += rangeMovements.dispatch;
    categoryMap[item.category].closingStock += closing;
  }

  const result = Object.entries(categoryMap).map(([category, data]) => ({ category, ...data }));
  res.json(result);
});

router.get("/reports/production-summary", authenticate, async (req, res): Promise<void> => {
  const params = GetProductionSummaryReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { fromDate, toDate } = params.data;
  if (!fromDate || !toDate) {
    res.status(400).json({ error: "fromDate and toDate are required" });
    return;
  }

  const rows = await db
    .select({
      stockItemId: productionEntriesTable.stockItemId,
      totalQuantity: sql<string>`SUM(${productionEntriesTable.quantity})`,
    })
    .from(productionEntriesTable)
    .where(
      and(
        sql`${productionEntriesTable.date} >= ${fromDate}`,
        sql`${productionEntriesTable.date} <= ${toDate}`,
      ),
    )
    .groupBy(productionEntriesTable.stockItemId)
    .orderBy(sql`SUM(${productionEntriesTable.quantity}) DESC`);

  const result = await Promise.all(
    rows.map(async (r) => {
      const [item] = await db.select().from(stockMasterTable).where(eq(stockMasterTable.id, r.stockItemId));
      return {
        stockItemId: r.stockItemId,
        itemCode: item?.itemCode ?? "",
        category: item?.category ?? "",
        size: item?.size ?? "",
        length: item?.length ?? "",
        totalQuantity: parseFloat(r.totalQuantity),
      };
    }),
  );

  res.json(result);
});

router.get("/reports/dispatch-summary", authenticate, async (req, res): Promise<void> => {
  const params = GetDispatchSummaryReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { fromDate, toDate } = params.data;
  if (!fromDate || !toDate) {
    res.status(400).json({ error: "fromDate and toDate are required" });
    return;
  }

  const items = await db.select().from(stockMasterTable).where(eq(stockMasterTable.status, "active"));
  const from = toDateString(fromDate);
  const to = toDateString(toDate);
  const result = await Promise.all(
    items.map(async (item) => {
      const totals = await getRangeMovementTotals(item.id, from, to);
      return {
        stockItemId: item.id,
        itemCode: item.itemCode,
        category: item.category,
        size: item.size,
        length: item.length,
        totalQuantity: totals.dispatch,
      };
    }),
  );

  res.json(result.filter((row) => row.totalQuantity > 0).sort((a, b) => b.totalQuantity - a.totalQuantity));
});

export default router;
