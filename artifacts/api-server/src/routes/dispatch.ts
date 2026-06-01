import { Router } from "express";
import { eq, and, sql, ilike } from "drizzle-orm";
import { db, dispatchEntriesTable, stockMasterTable, usersTable } from "@workspace/db";
import {
  ListDispatchQueryParams,
  CreateDispatchBody,
  GetDispatchParams,
  UpdateDispatchParams,
  UpdateDispatchBody,
  DeleteDispatchParams,
} from "@workspace/api-zod";
import { authenticate, requireRole } from "../lib/auth";
import { logAudit } from "../lib/auditLogger";

const router = Router();

const toDateString = (value: string | Date) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;

const withJoins = () =>
  db
    .select({
      id: dispatchEntriesTable.id,
      date: dispatchEntriesTable.date,
      stockItemId: dispatchEntriesTable.stockItemId,
      quantity: dispatchEntriesTable.quantity,
      partyName: dispatchEntriesTable.partyName,
      invoiceNumber: dispatchEntriesTable.invoiceNumber,
      vehicleNumber: dispatchEntriesTable.vehicleNumber,
      remarks: dispatchEntriesTable.remarks,
      createdById: dispatchEntriesTable.createdById,
      updatedById: dispatchEntriesTable.updatedById,
      createdAt: dispatchEntriesTable.createdAt,
      updatedAt: dispatchEntriesTable.updatedAt,
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
    .from(dispatchEntriesTable)
    .innerJoin(stockMasterTable, eq(dispatchEntriesTable.stockItemId, stockMasterTable.id));

router.get("/dispatch", authenticate, async (req, res): Promise<void> => {
  const params = ListDispatchQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { date, fromDate, toDate, stockItemId, partyName } = params.data;

  const conditions = [];
  if (date) conditions.push(sql`${dispatchEntriesTable.date} = ${date}`);
  if (fromDate) conditions.push(sql`${dispatchEntriesTable.date} >= ${fromDate}`);
  if (toDate) conditions.push(sql`${dispatchEntriesTable.date} <= ${toDate}`);
  if (stockItemId) conditions.push(eq(dispatchEntriesTable.stockItemId, stockItemId));
  if (partyName) conditions.push(ilike(dispatchEntriesTable.partyName, `%${partyName}%`));

  let query = withJoins().$dynamic();
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  const rows = await query.orderBy(sql`${dispatchEntriesTable.date} DESC`, dispatchEntriesTable.id);

  const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const result = rows.map((r) => ({
    ...r,
    createdByName: r.createdById ? (userMap[r.createdById] ?? null) : null,
    updatedByName: r.updatedById ? (userMap[r.updatedById] ?? null) : null,
  }));

  res.json(result);
});

router.post("/dispatch", authenticate, requireRole("admin", "dispatch"), async (req, res): Promise<void> => {
  const parsed = CreateDispatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [entry] = await db
    .insert(dispatchEntriesTable)
    .values({
      ...parsed.data,
      date: toDateString(parsed.data.date),
      quantity: String(parsed.data.quantity),
      createdById: req.user!.userId,
    })
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: "CREATE_DISPATCH",
    entityType: "dispatch",
    entityId: entry.id,
    newValue: { stockItemId: entry.stockItemId, quantity: entry.quantity, partyName: entry.partyName, date: entry.date },
  });

  const [full] = await withJoins().where(eq(dispatchEntriesTable.id, entry.id));
  const [creator] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
  res.status(201).json({ ...full, createdByName: creator?.name ?? null, updatedByName: null });
});

router.get("/dispatch/:id", authenticate, async (req, res): Promise<void> => {
  const params = GetDispatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [entry] = await withJoins().where(eq(dispatchEntriesTable.id, params.data.id));
  if (!entry) {
    res.status(404).json({ error: "Dispatch entry not found" });
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

router.patch("/dispatch/:id", authenticate, requireRole("admin", "dispatch"), async (req, res): Promise<void> => {
  const params = UpdateDispatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDispatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [old] = await db.select().from(dispatchEntriesTable).where(eq(dispatchEntriesTable.id, params.data.id));
  if (!old) {
    res.status(404).json({ error: "Dispatch entry not found" });
    return;
  }
  const updateData: Record<string, unknown> = { updatedById: req.user!.userId };
  if (parsed.data.quantity != null) updateData.quantity = String(parsed.data.quantity);
  if (parsed.data.partyName != null) updateData.partyName = parsed.data.partyName;
  if (parsed.data.invoiceNumber != null) updateData.invoiceNumber = parsed.data.invoiceNumber;
  if (parsed.data.vehicleNumber != null) updateData.vehicleNumber = parsed.data.vehicleNumber;
  if (parsed.data.remarks != null) updateData.remarks = parsed.data.remarks;

  const [entry] = await db
    .update(dispatchEntriesTable)
    .set(updateData)
    .where(eq(dispatchEntriesTable.id, params.data.id))
    .returning();

  await logAudit({
    userId: req.user!.userId,
    action: "UPDATE_DISPATCH",
    entityType: "dispatch",
    entityId: params.data.id,
    oldValue: { quantity: old.quantity, partyName: old.partyName },
    newValue: { quantity: entry.quantity, partyName: entry.partyName },
  });

  const [full] = await withJoins().where(eq(dispatchEntriesTable.id, entry.id));
  const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  res.json({
    ...full,
    createdByName: full.createdById ? (userMap[full.createdById] ?? null) : null,
    updatedByName: full.updatedById ? (userMap[full.updatedById] ?? null) : null,
  });
});

router.delete("/dispatch/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteDispatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(dispatchEntriesTable)
    .where(eq(dispatchEntriesTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Dispatch entry not found" });
    return;
  }
  await logAudit({
    userId: req.user!.userId,
    action: "DELETE_DISPATCH",
    entityType: "dispatch",
    entityId: params.data.id,
    oldValue: { quantity: deleted.quantity, partyName: deleted.partyName, date: deleted.date },
  });
  res.sendStatus(204);
});

export default router;
