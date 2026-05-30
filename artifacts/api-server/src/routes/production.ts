import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, productionEntriesTable, stockMasterTable, usersTable } from "@workspace/db";
import {
  ListProductionQueryParams,
  CreateProductionBody,
  GetProductionParams,
  UpdateProductionParams,
  UpdateProductionBody,
  DeleteProductionParams,
} from "@workspace/api-zod";
import { authenticate, requireRole } from "../lib/auth";
import { logAudit } from "../lib/auditLogger";

const router = Router();

const withJoins = () =>
  db
    .select({
      id: productionEntriesTable.id,
      date: productionEntriesTable.date,
      stockItemId: productionEntriesTable.stockItemId,
      quantity: productionEntriesTable.quantity,
      remarks: productionEntriesTable.remarks,
      createdById: productionEntriesTable.createdById,
      updatedById: productionEntriesTable.updatedById,
      createdAt: productionEntriesTable.createdAt,
      updatedAt: productionEntriesTable.updatedAt,
      stockItem: {
        id: stockMasterTable.id,
        itemCode: stockMasterTable.itemCode,
        category: stockMasterTable.category,
        size: stockMasterTable.size,
        length: stockMasterTable.length,
        unit: stockMasterTable.unit,
        status: stockMasterTable.status,
        createdAt: stockMasterTable.createdAt,
      },
    })
    .from(productionEntriesTable)
    .innerJoin(stockMasterTable, eq(productionEntriesTable.stockItemId, stockMasterTable.id));

router.get("/production", authenticate, async (req, res): Promise<void> => {
  const params = ListProductionQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { date, fromDate, toDate, stockItemId } = params.data;

  const conditions = [];
  if (date) conditions.push(sql`${productionEntriesTable.date} = ${date}`);
  if (fromDate) conditions.push(sql`${productionEntriesTable.date} >= ${fromDate}`);
  if (toDate) conditions.push(sql`${productionEntriesTable.date} <= ${toDate}`);
  if (stockItemId) conditions.push(eq(productionEntriesTable.stockItemId, stockItemId));

  let query = withJoins().$dynamic();
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  const rows = await query.orderBy(sql`${productionEntriesTable.date} DESC`, productionEntriesTable.id);

  // Fetch user names
  const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const result = rows.map((r) => ({
    ...r,
    createdByName: r.createdById ? (userMap[r.createdById] ?? null) : null,
    updatedByName: r.updatedById ? (userMap[r.updatedById] ?? null) : null,
  }));

  res.json(result);
});

router.post("/production", authenticate, requireRole("admin", "production"), async (req, res): Promise<void> => {
  const parsed = CreateProductionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [entry] = await db
    .insert(productionEntriesTable)
    .values({ ...parsed.data, quantity: String(parsed.data.quantity), createdById: req.user!.userId })
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: "CREATE_PRODUCTION",
    entityType: "production",
    entityId: entry.id,
    newValue: { stockItemId: entry.stockItemId, quantity: entry.quantity, date: entry.date },
  });

  const [full] = await withJoins()
    .where(eq(productionEntriesTable.id, entry.id));
  const [creator] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
  res.status(201).json({ ...full, createdByName: creator?.name ?? null, updatedByName: null });
});

router.get("/production/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetProductionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [entry] = await withJoins().where(eq(productionEntriesTable.id, params.data.id));
  if (!entry) {
    res.status(404).json({ error: "Production entry not found" });
    return;
  }
  const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  res.json({
    ...entry,
    createdByName: entry.createdById ? (userMap[entry.createdById] ?? null) : null,
    updatedByName: entry.updatedById ? (userMap[entry.updatedById] ?? null) : null,
  });
});

router.patch("/production/:id", authenticate, requireRole("admin", "production"), async (req, res): Promise<void> => {
  const params = UpdateProductionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProductionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [old] = await db.select().from(productionEntriesTable).where(eq(productionEntriesTable.id, params.data.id));
  if (!old) {
    res.status(404).json({ error: "Production entry not found" });
    return;
  }
  const updateData: Record<string, unknown> = { updatedById: req.user!.userId };
  if (parsed.data.quantity != null) updateData.quantity = String(parsed.data.quantity);
  if (parsed.data.remarks != null) updateData.remarks = parsed.data.remarks;

  const [entry] = await db
    .update(productionEntriesTable)
    .set(updateData)
    .where(eq(productionEntriesTable.id, params.data.id))
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: "UPDATE_PRODUCTION",
    entityType: "production",
    entityId: params.data.id,
    oldValue: { quantity: old.quantity },
    newValue: { quantity: entry.quantity },
  });

  const [full] = await withJoins().where(eq(productionEntriesTable.id, entry.id));
  const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  res.json({
    ...full,
    createdByName: full.createdById ? (userMap[full.createdById] ?? null) : null,
    updatedByName: full.updatedById ? (userMap[full.updatedById] ?? null) : null,
  });
});

router.delete("/production/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteProductionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(productionEntriesTable)
    .where(eq(productionEntriesTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Production entry not found" });
    return;
  }
  await logAudit({
    userId: req.user!.userId,
    action: "DELETE_PRODUCTION",
    entityType: "production",
    entityId: params.data.id,
    oldValue: { quantity: deleted.quantity, date: deleted.date },
  });
  res.sendStatus(204);
});

export default router;
