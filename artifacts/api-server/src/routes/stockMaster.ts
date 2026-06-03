import { Router } from "express";
import { eq, ilike, or, sql } from "drizzle-orm";
import { db, stockMasterTable } from "@workspace/db";
import {
  ListStockItemsQueryParams,
  CreateStockItemBody,
  GetStockItemParams,
  UpdateStockItemParams,
  UpdateStockItemBody,
  DeleteStockItemParams,
} from "@workspace/api-zod";
import { authenticate, requireRole } from "../lib/auth";
import { logAudit } from "../lib/auditLogger";

const router = Router();

function generateItemCode(
  category: string,
  size: string,
  length: string,
): string {
  const cat = category
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 6);
  const sz = size
    .replace(/[^A-Z0-9X]/gi, "")
    .toUpperCase()
    .slice(0, 6);
  const ln = length
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 4);
  return `${cat}-${sz}-${ln}`;
}

router.get("/stock-master", authenticate, async (req, res): Promise<void> => {
  const params = ListStockItemsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { category, status, search } = params.data;

  let query = db.select().from(stockMasterTable).$dynamic();

  const conditions = [];
  if (category) conditions.push(eq(stockMasterTable.category, category));
  if (status)
    conditions.push(
      eq(stockMasterTable.status, status as "active" | "inactive"),
    );
  if (search) {
    conditions.push(
      or(
        ilike(stockMasterTable.category, `%${search}%`),
        ilike(stockMasterTable.size, `%${search}%`),
        ilike(stockMasterTable.length, `%${search}%`),
        ilike(stockMasterTable.itemCode, `%${search}%`),
      )!,
    );
  }
  if (conditions.length > 0) {
    query = query.where(
      conditions.length === 1
        ? conditions[0]
        : sql`${conditions[0]}${conditions
            .slice(1)
            .map((c) => sql` AND ${c}`)
            .reduce((a, b) => sql`${a}${b}`)}`,
    );
  }

  const items = await query.orderBy(
    stockMasterTable.category,
    stockMasterTable.size,
  );
  res.json(items);
});

router.post(
  "/stock-master",
  authenticate,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = CreateStockItemBody.safeParse(req.body);
    console.log("REQ BODY", req.body);
    if (parsed.success) {
      console.log("PARSED DATA", parsed.data);
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { category, size, sizeDiff, length, unit, status } = parsed.data;

    // Check uniqueness
    const [existing] = await db
      .select()
      .from(stockMasterTable)
      .where(
        sql`LOWER(${stockMasterTable.category}) = LOWER(${category}) AND LOWER(${stockMasterTable.size}) = LOWER(${size}) AND LOWER(${stockMasterTable.length}) = LOWER(${length})`,
      );
    if (existing) {
      res.status(400).json({
        error: "A stock item with this Category + Size + Length already exists",
      });
      return;
    }

    const itemCode = generateItemCode(category, size, length);
    const [item] = await db
      .insert(stockMasterTable)
      .values({
        category,
        size,
        sizeDiff,
        length,
        unit: unit ?? "NOS",
        status: status ?? "active",
        itemCode,
      })
      .returning();

    await logAudit({
      userId: req.user!.userId,
      action: "CREATE_STOCK_ITEM",
      entityType: "stock_master",
      entityId: item.id,
      newValue: { itemCode: item.itemCode },
    });
    res.status(201).json(item);
  },
);

router.get(
  "/stock-master/categories",
  authenticate,
  async (_req, res): Promise<void> => {
    const rows = await db
      .selectDistinct({ category: stockMasterTable.category })
      .from(stockMasterTable)
      .orderBy(stockMasterTable.category);
    res.json(rows.map((r) => r.category));
  },
);

router.get(
  "/stock-master/:id",
  authenticate,
  async (req, res): Promise<void> => {
    const params = GetStockItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [item] = await db
      .select()
      .from(stockMasterTable)
      .where(eq(stockMasterTable.id, params.data.id));
    if (!item) {
      res.status(404).json({ error: "Stock item not found" });
      return;
    }
    res.json(item);
  },
);

router.patch(
  "/stock-master/:id",
  authenticate,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const params = UpdateStockItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateStockItemBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [old] = await db
      .select()
      .from(stockMasterTable)
      .where(eq(stockMasterTable.id, params.data.id));
    if (!old) {
      res.status(404).json({ error: "Stock item not found" });
      return;
    }
    const [item] = await db
      .update(stockMasterTable)
      .set(parsed.data)
      .where(eq(stockMasterTable.id, params.data.id))
      .returning();
    await logAudit({
      userId: req.user!.userId,
      action: "UPDATE_STOCK_ITEM",
      entityType: "stock_master",
      entityId: params.data.id,
      oldValue: old,
      newValue: parsed.data,
    });
    res.json(item);
  },
);

router.delete(
  "/stock-master/:id",
  authenticate,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const params = DeleteStockItemParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    let deleted;

    try {
      [deleted] = await db
        .delete(stockMasterTable)
        .where(eq(stockMasterTable.id, params.data.id))
        .returning();
    } catch (error: any) {
      console.error("DELETE ERROR");
      console.error(error);
      console.error("MESSAGE:", error?.message);
      console.error("CODE:", error?.code);
      console.error("DETAIL:", error?.detail);
      console.error("CONSTRAINT:", error?.constraint);
      console.error("CAUSE:", error?.cause);

      throw error;
    }
    if (!deleted) {
      res.status(404).json({ error: "Stock item not found" });
      return;
    }
    await logAudit({
      userId: req.user!.userId,
      action: "DELETE_STOCK_ITEM",
      entityType: "stock_master",
      entityId: params.data.id,
      oldValue: { itemCode: deleted.itemCode },
    });
    res.sendStatus(204);
  },
);

export default router;
