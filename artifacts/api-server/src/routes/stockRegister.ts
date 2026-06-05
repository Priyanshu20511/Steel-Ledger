import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, stockMasterTable } from "@workspace/db";
import { GetStockRegisterQueryParams } from "@workspace/api-zod";
import { authenticate } from "../lib/auth";
import { getStockRegisterRow } from "../lib/stockEngine";

const router = Router();

const toDateString = (value: string | Date) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;

router.get("/stock-register", authenticate, async (req, res): Promise<void> => {
  const params = GetStockRegisterQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { date: dateParam, category, size, length } = params.data;
  const date = dateParam
    ? toDateString(dateParam)
    : new Date().toISOString().slice(0, 10);

  // Get all active stock items
  const conditions = [eq(stockMasterTable.status, "active")];
  if (category) conditions.push(eq(stockMasterTable.category, category));
  if (size) conditions.push(eq(stockMasterTable.size, size));
  if (length) conditions.push(eq(stockMasterTable.length, length));

  const items = await db
    .select()
    .from(stockMasterTable)
    .where(and(...conditions))
    .orderBy(
      stockMasterTable.category,
      stockMasterTable.size,
      stockMasterTable.length,
    );

  // For each item, compute stock register row
  const rows = await Promise.all(
    items.map(async (item) => {
      const {
        openingStock,
        production,
        purchase,
        saleReturn,
        dispatch,
        closingStock,
      } = await getStockRegisterRow(item.id, date);

      return {
        stockItemId: item.id,
        itemCode: item.itemCode,
        category: item.category,
        size: item.size,
        length: item.length,
        unit: item.unit,
        openingStock,
        production,
        purchase,
        saleReturn,
        dispatch,
        closingStock,
      };
    }),
  );

  res.json(rows);
});
router.get(
  "/stock-register/export-all",
  authenticate,
  async (_req, res): Promise<void> => {
    const items = await db
      .select()
      .from(stockMasterTable)
      .where(eq(stockMasterTable.status, "active"))
      .orderBy(
        stockMasterTable.category,
        stockMasterTable.size,
        stockMasterTable.length,
      );

    const today = new Date();
    const startDate = new Date("2025-01-01"); // adjust if needed

    const rows: string[] = [];

    rows.push(
      "Date,Item Code,Category,Size,Length,Opening Stock,Production,Dispatch,Closing Stock,Unit",
    );

    for (
      let current = new Date(startDate);
      current <= today;
      current.setDate(current.getDate() + 1)
    ) {
      const date = current.toISOString().slice(0, 10);

      for (const item of items) {
        const register = await getStockRegisterRow(item.id, date);

        rows.push(
          [
            date,
            item.itemCode,
            item.category,
            item.size,
            item.length,
            register.openingStock,
            register.production,
            register.dispatch,
            register.closingStock,
            item.unit,
          ].join(","),
        );
      }
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="stock-register-all.csv"',
    );

    res.send(rows.join("\n"));
  },
);
export default router;
