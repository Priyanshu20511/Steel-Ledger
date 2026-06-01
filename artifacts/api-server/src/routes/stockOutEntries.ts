import { Router } from "express";
import { eq, and, sql, ilike } from "drizzle-orm";
import {
  db,
  saleEntriesTable,
  purchaseReturnEntriesTable,
  issueProductionEntriesTable,
  stockMasterTable,
  usersTable,
} from "@workspace/db";
import { authenticate, requireRole } from "../lib/auth";
import { logAudit } from "../lib/auditLogger";

const router = Router();

const toDateString = (value: string | Date) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;

function positiveInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type PartyOutBody = {
  date: string | Date;
  stockItemId: number;
  partyName: string;
  quantity: number;
  baseRate?: number | null;
  invoiceNumber?: string;
  vehicleNumber?: string;
  remarks?: string;
};

type PartyOutUpdateBody = {
  partyName?: string;
  quantity?: number;
  baseRate?: number | null;
  invoiceNumber?: string;
  vehicleNumber?: string;
  remarks?: string;
};

type SimpleOutBody = {
  date: string | Date;
  stockItemId: number;
  quantity: number;
  baseRate?: number | null;
  remarks?: string;
};

function parsePartyOutBody(body: Record<string, unknown>): { data?: PartyOutBody; error?: string } {
  const date = body.date instanceof Date || typeof body.date === "string" ? body.date : "";
  const stockItemId = positiveInt(body.stockItemId);
  const quantity = positiveNumber(body.quantity);
  const baseRate = body.baseRate == null || body.baseRate === "" ? null : positiveNumber(body.baseRate);
  const partyName = typeof body.partyName === "string" ? body.partyName.trim() : "";

  if (!date) return { error: "Date is required" };
  if (!stockItemId) return { error: "Valid stock item is required" };
  if (!partyName) return { error: "Party name is required" };
  if (!quantity) return { error: "Quantity must be greater than 0" };
  if (body.baseRate != null && body.baseRate !== "" && !baseRate) return { error: "Base rate must be greater than 0" };

  return {
    data: {
      date,
      stockItemId,
      partyName,
      quantity,
      baseRate,
      invoiceNumber: typeof body.invoiceNumber === "string" ? body.invoiceNumber : undefined,
      vehicleNumber: typeof body.vehicleNumber === "string" ? body.vehicleNumber : undefined,
      remarks: typeof body.remarks === "string" ? body.remarks : undefined,
    },
  };
}

function parsePartyOutUpdateBody(body: Record<string, unknown>): { data?: PartyOutUpdateBody; error?: string } {
  const data: PartyOutUpdateBody = {};

  if (body.partyName != null) {
    if (typeof body.partyName !== "string" || !body.partyName.trim()) {
      return { error: "Party name is required" };
    }
    data.partyName = body.partyName.trim();
  }

  if (body.quantity != null) {
    const quantity = positiveNumber(body.quantity);
    if (!quantity) return { error: "Quantity must be greater than 0" };
    data.quantity = quantity;
  }
  if (body.baseRate !== undefined) {
    if (body.baseRate === null || body.baseRate === "") {
      data.baseRate = null;
    } else {
      const baseRate = positiveNumber(body.baseRate);
      if (!baseRate) return { error: "Base rate must be greater than 0" };
      data.baseRate = baseRate;
    }
  }

  if (body.invoiceNumber != null && typeof body.invoiceNumber === "string") data.invoiceNumber = body.invoiceNumber;
  if (body.vehicleNumber != null && typeof body.vehicleNumber === "string") data.vehicleNumber = body.vehicleNumber;
  if (body.remarks != null && typeof body.remarks === "string") data.remarks = body.remarks;

  return { data };
}

function parseSimpleOutBody(body: Record<string, unknown>): { data?: SimpleOutBody; error?: string } {
  const date = body.date instanceof Date || typeof body.date === "string" ? body.date : "";
  const stockItemId = positiveInt(body.stockItemId);
  const quantity = positiveNumber(body.quantity);
  const baseRate = body.baseRate == null || body.baseRate === "" ? null : positiveNumber(body.baseRate);

  if (!date) return { error: "Date is required" };
  if (!stockItemId) return { error: "Valid stock item is required" };
  if (!quantity) return { error: "Quantity must be greater than 0" };
  if (body.baseRate != null && body.baseRate !== "" && !baseRate) return { error: "Base rate must be greater than 0" };

  return {
    data: {
      date,
      stockItemId,
      quantity,
      baseRate,
      remarks: typeof body.remarks === "string" ? body.remarks : undefined,
    },
  };
}

function makePartyOutRouter(config: {
  path: string;
  label: string;
  entityType: string;
  table: typeof saleEntriesTable | typeof purchaseReturnEntriesTable;
  roles: Array<"admin" | "dispatch">;
}) {
  const withJoins = () =>
    db
      .select({
        id: config.table.id,
        date: config.table.date,
        stockItemId: config.table.stockItemId,
        partyName: config.table.partyName,
        quantity: config.table.quantity,
        baseRate: config.table.baseRate,
        invoiceNumber: config.table.invoiceNumber,
        vehicleNumber: config.table.vehicleNumber,
        remarks: config.table.remarks,
        createdById: config.table.createdById,
        updatedById: config.table.updatedById,
        createdAt: config.table.createdAt,
        updatedAt: config.table.updatedAt,
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
      .from(config.table)
      .innerJoin(stockMasterTable, eq(config.table.stockItemId, stockMasterTable.id));

  router.get(config.path, authenticate, async (req, res): Promise<void> => {
    const { date, fromDate, toDate, stockItemId: rawStockItemId, partyName } = req.query;
    const stockItemId = rawStockItemId ? positiveInt(rawStockItemId) : null;
    const conditions = [];
    if (typeof date === "string") conditions.push(sql`${config.table.date} = ${date}`);
    if (typeof fromDate === "string") conditions.push(sql`${config.table.date} >= ${fromDate}`);
    if (typeof toDate === "string") conditions.push(sql`${config.table.date} <= ${toDate}`);
    if (stockItemId) conditions.push(eq(config.table.stockItemId, stockItemId));
    if (typeof partyName === "string") conditions.push(ilike(config.table.partyName, `%${partyName}%`));

    let query = withJoins().$dynamic();
    if (conditions.length > 0) query = query.where(and(...conditions));
    const rows = await query.orderBy(sql`${config.table.date} DESC`, config.table.id);

    const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    res.json(
      rows.map((row) => ({
        ...row,
        createdByName: row.createdById ? (userMap[row.createdById] ?? null) : null,
        updatedByName: row.updatedById ? (userMap[row.updatedById] ?? null) : null,
      })),
    );
  });

  router.post(config.path, authenticate, requireRole(...config.roles), async (req, res): Promise<void> => {
    const parsed = parsePartyOutBody(req.body);
    if (!parsed.data) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const [entry] = await db
      .insert(config.table)
      .values({
        ...parsed.data,
        date: toDateString(parsed.data.date),
        quantity: String(parsed.data.quantity),
        baseRate: parsed.data.baseRate != null ? String(parsed.data.baseRate) : null,
        createdById: req.user!.userId,
      })
      .returning();

    await logAudit({
      userId: req.user!.userId,
      action: `CREATE_${config.entityType.toUpperCase()}`,
      entityType: config.entityType,
      entityId: entry.id,
      newValue: {
        stockItemId: entry.stockItemId,
        quantity: entry.quantity,
        partyName: entry.partyName,
        date: entry.date,
      },
    });

    const [full] = await withJoins().where(eq(config.table.id, entry.id));
    const [creator] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
    res.status(201).json({ ...full, createdByName: creator?.name ?? null, updatedByName: null });
  });

  router.get(`${config.path}/:id`, authenticate, async (req, res): Promise<void> => {
    const id = positiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Valid id is required" });
      return;
    }

    const [entry] = await withJoins().where(eq(config.table.id, id));
    if (!entry) {
      res.status(404).json({ error: `${config.label} entry not found` });
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

  router.patch(`${config.path}/:id`, authenticate, requireRole(...config.roles), async (req, res): Promise<void> => {
    const id = positiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Valid id is required" });
      return;
    }

    const parsed = parsePartyOutUpdateBody(req.body);
    if (!parsed.data) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const updateData: Record<string, unknown> = { updatedById: req.user!.userId };
    if (parsed.data.quantity != null) updateData.quantity = String(parsed.data.quantity);
    if (parsed.data.baseRate !== undefined) updateData.baseRate = parsed.data.baseRate != null ? String(parsed.data.baseRate) : null;
    if (parsed.data.partyName != null) updateData.partyName = parsed.data.partyName;
    if (parsed.data.invoiceNumber != null) updateData.invoiceNumber = parsed.data.invoiceNumber;
    if (parsed.data.vehicleNumber != null) updateData.vehicleNumber = parsed.data.vehicleNumber;
    if (parsed.data.remarks != null) updateData.remarks = parsed.data.remarks;

    const [entry] = await db
      .update(config.table)
      .set(updateData)
      .where(eq(config.table.id, id))
      .returning();

    if (!entry) {
      res.status(404).json({ error: `${config.label} entry not found` });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: `UPDATE_${config.entityType.toUpperCase()}`,
      entityType: config.entityType,
      entityId: id,
      newValue: { quantity: entry.quantity, partyName: entry.partyName },
    });

    const [full] = await withJoins().where(eq(config.table.id, entry.id));
    res.json(full);
  });

  router.delete(`${config.path}/:id`, authenticate, requireRole("admin"), async (req, res): Promise<void> => {
    const id = positiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Valid id is required" });
      return;
    }

    const [deleted] = await db
      .delete(config.table)
      .where(eq(config.table.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: `${config.label} entry not found` });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: `DELETE_${config.entityType.toUpperCase()}`,
      entityType: config.entityType,
      entityId: id,
      oldValue: { quantity: deleted.quantity, partyName: deleted.partyName, date: deleted.date },
    });

    res.sendStatus(204);
  });
}

function makeSimpleOutRouter(config: {
  path: string;
  label: string;
  entityType: string;
  table: typeof issueProductionEntriesTable;
  roles: Array<"admin" | "production">;
}) {
  const withJoins = () =>
    db
      .select({
        id: config.table.id,
        date: config.table.date,
        stockItemId: config.table.stockItemId,
        quantity: config.table.quantity,
        baseRate: config.table.baseRate,
        remarks: config.table.remarks,
        createdById: config.table.createdById,
        updatedById: config.table.updatedById,
        createdAt: config.table.createdAt,
        updatedAt: config.table.updatedAt,
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
      .from(config.table)
      .innerJoin(stockMasterTable, eq(config.table.stockItemId, stockMasterTable.id));

  router.get(config.path, authenticate, async (req, res): Promise<void> => {
    const { date, fromDate, toDate, stockItemId: rawStockItemId } = req.query;
    const stockItemId = rawStockItemId ? positiveInt(rawStockItemId) : null;
    const conditions = [];
    if (typeof date === "string") conditions.push(sql`${config.table.date} = ${date}`);
    if (typeof fromDate === "string") conditions.push(sql`${config.table.date} >= ${fromDate}`);
    if (typeof toDate === "string") conditions.push(sql`${config.table.date} <= ${toDate}`);
    if (stockItemId) conditions.push(eq(config.table.stockItemId, stockItemId));

    let query = withJoins().$dynamic();
    if (conditions.length > 0) query = query.where(and(...conditions));
    const rows = await query.orderBy(sql`${config.table.date} DESC`, config.table.id);

    const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

    res.json(
      rows.map((row) => ({
        ...row,
        createdByName: row.createdById ? (userMap[row.createdById] ?? null) : null,
        updatedByName: row.updatedById ? (userMap[row.updatedById] ?? null) : null,
      })),
    );
  });

  router.post(config.path, authenticate, requireRole(...config.roles), async (req, res): Promise<void> => {
    const parsed = parseSimpleOutBody(req.body);
    if (!parsed.data) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const [entry] = await db
      .insert(config.table)
      .values({
        ...parsed.data,
        date: toDateString(parsed.data.date),
        quantity: String(parsed.data.quantity),
        baseRate: parsed.data.baseRate != null ? String(parsed.data.baseRate) : null,
        createdById: req.user!.userId,
      })
      .returning();

    await logAudit({
      userId: req.user!.userId,
      action: `CREATE_${config.entityType.toUpperCase()}`,
      entityType: config.entityType,
      entityId: entry.id,
      newValue: { stockItemId: entry.stockItemId, quantity: entry.quantity, date: entry.date },
    });

    const [full] = await withJoins().where(eq(config.table.id, entry.id));
    const [creator] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
    res.status(201).json({ ...full, createdByName: creator?.name ?? null, updatedByName: null });
  });

  router.get(`${config.path}/:id`, authenticate, async (req, res): Promise<void> => {
    const id = positiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Valid id is required" });
      return;
    }

    const [entry] = await withJoins().where(eq(config.table.id, id));
    if (!entry) {
      res.status(404).json({ error: `${config.label} entry not found` });
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

  router.patch(`${config.path}/:id`, authenticate, requireRole(...config.roles), async (req, res): Promise<void> => {
    const id = positiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Valid id is required" });
      return;
    }
    const quantity = req.body.quantity != null ? positiveNumber(req.body.quantity) : null;
    if (req.body.quantity != null && !quantity) {
      res.status(400).json({ error: "Quantity must be greater than 0" });
      return;
    }
    let baseRate: number | null | undefined;
    if (req.body.baseRate !== undefined) {
      if (req.body.baseRate === null || req.body.baseRate === "") {
        baseRate = null;
      } else {
        const parsedBaseRate = positiveNumber(req.body.baseRate);
        if (!parsedBaseRate) {
          res.status(400).json({ error: "Base rate must be greater than 0" });
          return;
        }
        baseRate = parsedBaseRate;
      }
    }
    const remarks = typeof req.body.remarks === "string" ? req.body.remarks : undefined;

    const updateData: Record<string, unknown> = { updatedById: req.user!.userId };
    if (quantity != null) updateData.quantity = String(quantity);
    if (baseRate !== undefined) updateData.baseRate = baseRate != null ? String(baseRate) : null;
    if (remarks != null) updateData.remarks = remarks;

    const [entry] = await db
      .update(config.table)
      .set(updateData)
      .where(eq(config.table.id, id))
      .returning();

    if (!entry) {
      res.status(404).json({ error: `${config.label} entry not found` });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: `UPDATE_${config.entityType.toUpperCase()}`,
      entityType: config.entityType,
      entityId: id,
      newValue: { quantity: entry.quantity },
    });

    const [full] = await withJoins().where(eq(config.table.id, entry.id));
    res.json(full);
  });

  router.delete(`${config.path}/:id`, authenticate, requireRole("admin"), async (req, res): Promise<void> => {
    const id = positiveInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Valid id is required" });
      return;
    }

    const [deleted] = await db
      .delete(config.table)
      .where(eq(config.table.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: `${config.label} entry not found` });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: `DELETE_${config.entityType.toUpperCase()}`,
      entityType: config.entityType,
      entityId: id,
      oldValue: { quantity: deleted.quantity, date: deleted.date },
    });

    res.sendStatus(204);
  });
}

makePartyOutRouter({
  path: "/sale",
  label: "Sale",
  entityType: "sale",
  table: saleEntriesTable,
  roles: ["admin", "dispatch"],
});

makePartyOutRouter({
  path: "/purchase-return",
  label: "Purchase return",
  entityType: "purchase_return",
  table: purchaseReturnEntriesTable,
  roles: ["admin", "dispatch"],
});

makeSimpleOutRouter({
  path: "/issue-production",
  label: "Issue production",
  entityType: "issue_production",
  table: issueProductionEntriesTable,
  roles: ["admin", "production"],
});

export default router;
