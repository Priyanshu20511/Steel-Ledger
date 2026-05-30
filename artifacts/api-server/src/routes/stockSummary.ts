import { Router } from "express";
import { eq, sql, sum, count, and } from "drizzle-orm";
import { db, stockMasterTable, productionEntriesTable, dispatchEntriesTable } from "@workspace/db";
import { GetStockSummaryQueryParams } from "@workspace/api-zod";
import { authenticate } from "../lib/auth";
import { getOpeningStock } from "../lib/stockEngine";

const router = Router();

router.get("/stock-summary", authenticate, async (req, res): Promise<void> => {
  const params = GetStockSummaryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const date = params.data.date ?? new Date().toISOString().slice(0, 10);
  const now = new Date(date);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const items = await db
    .select({ id: stockMasterTable.id })
    .from(stockMasterTable)
    .where(eq(stockMasterTable.status, "active"));

  let totalOpeningStock = 0;
  let totalClosingStock = 0;
  let lowStockCount = 0;

  for (const item of items) {
    const opening = await getOpeningStock(item.id, date);
    totalOpeningStock += opening;

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
    const closing = opening + production - dispatch;
    totalClosingStock += closing;
    if (closing <= 0) lowStockCount++;
  }

  // Today's production and dispatch totals
  const [todayProd] = await db
    .select({ total: sql<string>`COALESCE(SUM(${productionEntriesTable.quantity}), 0)` })
    .from(productionEntriesTable)
    .where(sql`${productionEntriesTable.date} = ${date}`);

  const [todayDisp] = await db
    .select({ total: sql<string>`COALESCE(SUM(${dispatchEntriesTable.quantity}), 0)` })
    .from(dispatchEntriesTable)
    .where(sql`${dispatchEntriesTable.date} = ${date}`);

  // Monthly totals
  const [monthProd] = await db
    .select({ total: sql<string>`COALESCE(SUM(${productionEntriesTable.quantity}), 0)` })
    .from(productionEntriesTable)
    .where(
      and(
        sql`${productionEntriesTable.date} >= ${monthStart}`,
        sql`${productionEntriesTable.date} <= ${date}`,
      ),
    );

  const [monthDisp] = await db
    .select({ total: sql<string>`COALESCE(SUM(${dispatchEntriesTable.quantity}), 0)` })
    .from(dispatchEntriesTable)
    .where(
      and(
        sql`${dispatchEntriesTable.date} >= ${monthStart}`,
        sql`${dispatchEntriesTable.date} <= ${date}`,
      ),
    );

  res.json({
    date,
    totalOpeningStock,
    totalProduction: parseFloat(todayProd?.total ?? "0"),
    totalDispatch: parseFloat(todayDisp?.total ?? "0"),
    totalClosingStock,
    totalItems: items.length,
    lowStockCount,
    monthlyProduction: parseFloat(monthProd?.total ?? "0"),
    monthlyDispatch: parseFloat(monthDisp?.total ?? "0"),
  });
});

router.get("/stock-summary/low-stock", authenticate, async (_req, res): Promise<void> => {
  const date = new Date().toISOString().slice(0, 10);
  const items = await db
    .select()
    .from(stockMasterTable)
    .where(eq(stockMasterTable.status, "active"));

  const lowItems = [];
  for (const item of items) {
    const opening = await getOpeningStock(item.id, date);
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
    const currentStock = opening + production - dispatch;
    if (currentStock <= 0) {
      lowItems.push({
        stockItemId: item.id,
        itemCode: item.itemCode,
        category: item.category,
        size: item.size,
        length: item.length,
        unit: item.unit,
        currentStock,
      });
    }
  }
  res.json(lowItems);
});

router.get("/stock-summary/top-produced", authenticate, async (_req, res): Promise<void> => {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);

  const rows = await db
    .select({
      stockItemId: productionEntriesTable.stockItemId,
      totalQuantity: sql<string>`SUM(${productionEntriesTable.quantity})`,
    })
    .from(productionEntriesTable)
    .where(
      and(
        sql`${productionEntriesTable.date} >= ${monthStart}`,
        sql`${productionEntriesTable.date} <= ${today}`,
      ),
    )
    .groupBy(productionEntriesTable.stockItemId)
    .orderBy(sql`SUM(${productionEntriesTable.quantity}) DESC`)
    .limit(10);

  const result = await Promise.all(
    rows.map(async (r) => {
      const [item] = await db.select().from(stockMasterTable).where(eq(stockMasterTable.id, r.stockItemId));
      return {
        stockItemId: r.stockItemId,
        itemCode: item?.itemCode ?? "",
        category: item?.category ?? "",
        size: item?.size ?? "",
        length: item?.length ?? "",
        quantity: parseFloat(r.totalQuantity),
      };
    }),
  );

  res.json(result);
});

router.get("/stock-summary/top-dispatched", authenticate, async (_req, res): Promise<void> => {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);

  const rows = await db
    .select({
      stockItemId: dispatchEntriesTable.stockItemId,
      totalQuantity: sql<string>`SUM(${dispatchEntriesTable.quantity})`,
    })
    .from(dispatchEntriesTable)
    .where(
      and(
        sql`${dispatchEntriesTable.date} >= ${monthStart}`,
        sql`${dispatchEntriesTable.date} <= ${today}`,
      ),
    )
    .groupBy(dispatchEntriesTable.stockItemId)
    .orderBy(sql`SUM(${dispatchEntriesTable.quantity}) DESC`)
    .limit(10);

  const result = await Promise.all(
    rows.map(async (r) => {
      const [item] = await db.select().from(stockMasterTable).where(eq(stockMasterTable.id, r.stockItemId));
      return {
        stockItemId: r.stockItemId,
        itemCode: item?.itemCode ?? "",
        category: item?.category ?? "",
        size: item?.size ?? "",
        length: item?.length ?? "",
        quantity: parseFloat(r.totalQuantity),
      };
    }),
  );

  res.json(result);
});

router.get("/stock-summary/monthly-trend", authenticate, async (_req, res): Promise<void> => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const result = await Promise.all(
    months.map(async ({ year, month }) => {
      const monthStr = String(month).padStart(2, "0");
      const start = `${year}-${monthStr}-01`;
      const endDate = new Date(year, month, 0);
      const end = endDate.toISOString().slice(0, 10);

      const [prodResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${productionEntriesTable.quantity}), 0)` })
        .from(productionEntriesTable)
        .where(
          and(
            sql`${productionEntriesTable.date} >= ${start}`,
            sql`${productionEntriesTable.date} <= ${end}`,
          ),
        );

      const [dispResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${dispatchEntriesTable.quantity}), 0)` })
        .from(dispatchEntriesTable)
        .where(
          and(
            sql`${dispatchEntriesTable.date} >= ${start}`,
            sql`${dispatchEntriesTable.date} <= ${end}`,
          ),
        );

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return {
        month,
        year,
        label: `${monthNames[month - 1]} ${year}`,
        production: parseFloat(prodResult?.total ?? "0"),
        dispatch: parseFloat(dispResult?.total ?? "0"),
      };
    }),
  );

  res.json(result);
});

router.get("/stock-summary/category-breakdown", authenticate, async (_req, res): Promise<void> => {
  const date = new Date().toISOString().slice(0, 10);
  const items = await db.select().from(stockMasterTable).where(eq(stockMasterTable.status, "active"));

  const categoryMap: Record<string, { closingStock: number; itemCount: number }> = {};

  for (const item of items) {
    const opening = await getOpeningStock(item.id, date);
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
    const closing = opening + production - dispatch;

    if (!categoryMap[item.category]) {
      categoryMap[item.category] = { closingStock: 0, itemCount: 0 };
    }
    categoryMap[item.category].closingStock += closing;
    categoryMap[item.category].itemCount++;
  }

  const result = Object.entries(categoryMap).map(([category, data]) => ({
    category,
    closingStock: data.closingStock,
    itemCount: data.itemCount,
  }));

  res.json(result.sort((a, b) => b.closingStock - a.closingStock));
});

export default router;
