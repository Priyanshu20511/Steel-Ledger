import { Router } from "express";
import { eq, sql, sum, and } from "drizzle-orm";
import {
  db,
  stockMasterTable,
  productionEntriesTable,
  purchaseEntriesTable,
  saleReturnEntriesTable,
  dispatchEntriesTable,
  saleEntriesTable,
  purchaseReturnEntriesTable,
  issueProductionEntriesTable,
} from "@workspace/db";
import { GetStockSummaryQueryParams } from "@workspace/api-zod";
import { authenticate } from "../lib/auth";
import { getOpeningStock, getDayMovementTotals, getRangeMovementTotals } from "../lib/stockEngine";

const router = Router();

const toDateString = (value: string | Date) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;

router.get("/stock-summary", authenticate, async (req, res): Promise<void> => {
  const params = GetStockSummaryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const date = params.data.date ? toDateString(params.data.date) : new Date().toISOString().slice(0, 10);
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
    const movements = await getDayMovementTotals(item.id, date);
    const closing = opening + movements.production + movements.purchase + movements.saleReturn - movements.dispatch;
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

  const [todaySale] = await db
    .select({ total: sql<string>`COALESCE(SUM(${saleEntriesTable.quantity}), 0)` })
    .from(saleEntriesTable)
    .where(sql`${saleEntriesTable.date} = ${date}`);

  const [todayPurchaseReturn] = await db
    .select({ total: sql<string>`COALESCE(SUM(${purchaseReturnEntriesTable.quantity}), 0)` })
    .from(purchaseReturnEntriesTable)
    .where(sql`${purchaseReturnEntriesTable.date} = ${date}`);

  const [todayIssueProduction] = await db
    .select({ total: sql<string>`COALESCE(SUM(${issueProductionEntriesTable.quantity}), 0)` })
    .from(issueProductionEntriesTable)
    .where(sql`${issueProductionEntriesTable.date} = ${date}`);

  const [todayPurchase] = await db
    .select({ total: sql<string>`COALESCE(SUM(${purchaseEntriesTable.quantity}), 0)` })
    .from(purchaseEntriesTable)
    .where(sql`${purchaseEntriesTable.date} = ${date}`);

  const [todaySaleReturn] = await db
    .select({ total: sql<string>`COALESCE(SUM(${saleReturnEntriesTable.quantity}), 0)` })
    .from(saleReturnEntriesTable)
    .where(sql`${saleReturnEntriesTable.date} = ${date}`);

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

  const [monthSale] = await db
    .select({ total: sql<string>`COALESCE(SUM(${saleEntriesTable.quantity}), 0)` })
    .from(saleEntriesTable)
    .where(
      and(
        sql`${saleEntriesTable.date} >= ${monthStart}`,
        sql`${saleEntriesTable.date} <= ${date}`,
      ),
    );

  const [monthPurchaseReturn] = await db
    .select({ total: sql<string>`COALESCE(SUM(${purchaseReturnEntriesTable.quantity}), 0)` })
    .from(purchaseReturnEntriesTable)
    .where(
      and(
        sql`${purchaseReturnEntriesTable.date} >= ${monthStart}`,
        sql`${purchaseReturnEntriesTable.date} <= ${date}`,
      ),
    );

  const [monthIssueProduction] = await db
    .select({ total: sql<string>`COALESCE(SUM(${issueProductionEntriesTable.quantity}), 0)` })
    .from(issueProductionEntriesTable)
    .where(
      and(
        sql`${issueProductionEntriesTable.date} >= ${monthStart}`,
        sql`${issueProductionEntriesTable.date} <= ${date}`,
      ),
    );

  const [monthPurchase] = await db
    .select({ total: sql<string>`COALESCE(SUM(${purchaseEntriesTable.quantity}), 0)` })
    .from(purchaseEntriesTable)
    .where(
      and(
        sql`${purchaseEntriesTable.date} >= ${monthStart}`,
        sql`${purchaseEntriesTable.date} <= ${date}`,
      ),
    );

  const [monthSaleReturn] = await db
    .select({ total: sql<string>`COALESCE(SUM(${saleReturnEntriesTable.quantity}), 0)` })
    .from(saleReturnEntriesTable)
    .where(
      and(
        sql`${saleReturnEntriesTable.date} >= ${monthStart}`,
        sql`${saleReturnEntriesTable.date} <= ${date}`,
      ),
    );

  res.json({
    date,
    totalOpeningStock,
    totalProduction: parseFloat(todayProd?.total ?? "0"),
    totalPurchase: parseFloat(todayPurchase?.total ?? "0"),
    totalSaleReturn: parseFloat(todaySaleReturn?.total ?? "0"),
    totalDispatch:
      parseFloat(todayDisp?.total ?? "0") +
      parseFloat(todaySale?.total ?? "0") +
      parseFloat(todayPurchaseReturn?.total ?? "0") +
      parseFloat(todayIssueProduction?.total ?? "0"),
    totalClosingStock,
    totalItems: items.length,
    lowStockCount,
    monthlyProduction: parseFloat(monthProd?.total ?? "0"),
    monthlyPurchase: parseFloat(monthPurchase?.total ?? "0"),
    monthlySaleReturn: parseFloat(monthSaleReturn?.total ?? "0"),
    monthlyDispatch:
      parseFloat(monthDisp?.total ?? "0") +
      parseFloat(monthSale?.total ?? "0") +
      parseFloat(monthPurchaseReturn?.total ?? "0") +
      parseFloat(monthIssueProduction?.total ?? "0"),
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
    const movements = await getDayMovementTotals(item.id, date);
    const currentStock = opening + movements.production + movements.purchase + movements.saleReturn - movements.dispatch;
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

  const items = await db.select().from(stockMasterTable).where(eq(stockMasterTable.status, "active"));
  const result = await Promise.all(
    items.map(async (item) => {
      const totals = await getRangeMovementTotals(item.id, monthStart, today);
      return {
        stockItemId: item.id,
        itemCode: item.itemCode,
        category: item.category,
        size: item.size,
        length: item.length,
        quantity: totals.dispatch,
      };
    }),
  );

  res.json(result.filter((row) => row.quantity > 0).sort((a, b) => b.quantity - a.quantity).slice(0, 10));
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

      const [saleResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${saleEntriesTable.quantity}), 0)` })
        .from(saleEntriesTable)
        .where(
          and(
            sql`${saleEntriesTable.date} >= ${start}`,
            sql`${saleEntriesTable.date} <= ${end}`,
          ),
        );

      const [purchaseReturnResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${purchaseReturnEntriesTable.quantity}), 0)` })
        .from(purchaseReturnEntriesTable)
        .where(
          and(
            sql`${purchaseReturnEntriesTable.date} >= ${start}`,
            sql`${purchaseReturnEntriesTable.date} <= ${end}`,
          ),
        );

      const [issueProductionResult] = await db
        .select({ total: sql<string>`COALESCE(SUM(${issueProductionEntriesTable.quantity}), 0)` })
        .from(issueProductionEntriesTable)
        .where(
          and(
            sql`${issueProductionEntriesTable.date} >= ${start}`,
            sql`${issueProductionEntriesTable.date} <= ${end}`,
          ),
        );

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return {
        month,
        year,
        label: `${monthNames[month - 1]} ${year}`,
        production: parseFloat(prodResult?.total ?? "0"),
        dispatch:
          parseFloat(dispResult?.total ?? "0") +
          parseFloat(saleResult?.total ?? "0") +
          parseFloat(purchaseReturnResult?.total ?? "0") +
          parseFloat(issueProductionResult?.total ?? "0"),
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
    const movements = await getDayMovementTotals(item.id, date);
    const closing = opening + movements.production - movements.dispatch;

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
