import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, stockMasterTable, productionEntriesTable, dispatchEntriesTable } from "@workspace/db";
import {
  GetDailyReportQueryParams,
  GetMonthlyReportQueryParams,
  GetCategoryReportQueryParams,
  GetProductionSummaryReportQueryParams,
  GetDispatchSummaryReportQueryParams,
} from "@workspace/api-zod";
import { authenticate } from "../lib/auth";
import { getOpeningStock } from "../lib/stockEngine";

const router = Router();

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

  const items = await db
    .select()
    .from(stockMasterTable)
    .where(eq(stockMasterTable.status, "active"))
    .orderBy(stockMasterTable.category, stockMasterTable.size);

  let totalProduction = 0;
  let totalDispatch = 0;

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

  res.json({ date, rows, totalProduction, totalDispatch });
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

  const allDates = [...new Set([...prodDates.map((d) => d.date), ...dispDates.map((d) => d.date)])].sort();

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
      const production = parseFloat(prodResult?.total ?? "0");
      const dispatch = parseFloat(dispResult?.total ?? "0");
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

  for (const item of items) {
    const [prodResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${productionEntriesTable.quantity}), 0)` })
      .from(productionEntriesTable)
      .where(
        and(
          eq(productionEntriesTable.stockItemId, item.id),
          sql`${productionEntriesTable.date} >= ${fromDate}`,
          sql`${productionEntriesTable.date} <= ${toDate}`,
        ),
      );
    const [dispResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${dispatchEntriesTable.quantity}), 0)` })
      .from(dispatchEntriesTable)
      .where(
        and(
          eq(dispatchEntriesTable.stockItemId, item.id),
          sql`${dispatchEntriesTable.date} >= ${fromDate}`,
          sql`${dispatchEntriesTable.date} <= ${toDate}`,
        ),
      );

    const opening = await getOpeningStock(item.id, today);
    const [todayProd] = await db
      .select({ total: sql<string>`COALESCE(SUM(${productionEntriesTable.quantity}), 0)` })
      .from(productionEntriesTable)
      .where(and(eq(productionEntriesTable.stockItemId, item.id), sql`${productionEntriesTable.date} = ${today}`));
    const [todayDisp] = await db
      .select({ total: sql<string>`COALESCE(SUM(${dispatchEntriesTable.quantity}), 0)` })
      .from(dispatchEntriesTable)
      .where(and(eq(dispatchEntriesTable.stockItemId, item.id), sql`${dispatchEntriesTable.date} = ${today}`));
    const closing = opening + parseFloat(todayProd?.total ?? "0") - parseFloat(todayDisp?.total ?? "0");

    if (!categoryMap[item.category]) {
      categoryMap[item.category] = { totalProduction: 0, totalDispatch: 0, closingStock: 0 };
    }
    categoryMap[item.category].totalProduction += parseFloat(prodResult?.total ?? "0");
    categoryMap[item.category].totalDispatch += parseFloat(dispResult?.total ?? "0");
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

  const rows = await db
    .select({
      stockItemId: dispatchEntriesTable.stockItemId,
      totalQuantity: sql<string>`SUM(${dispatchEntriesTable.quantity})`,
    })
    .from(dispatchEntriesTable)
    .where(
      and(
        sql`${dispatchEntriesTable.date} >= ${fromDate}`,
        sql`${dispatchEntriesTable.date} <= ${toDate}`,
      ),
    )
    .groupBy(dispatchEntriesTable.stockItemId)
    .orderBy(sql`SUM(${dispatchEntriesTable.quantity}) DESC`);

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

export default router;
