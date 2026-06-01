import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, openingStockTable, stockMasterTable } from "@workspace/db";
import {
  SetOpeningStockBody,
  ImportOpeningStockBody,
} from "@workspace/api-zod";
import { authenticate, requireRole } from "../lib/auth";
import { logAudit } from "../lib/auditLogger";

const router = Router();

const toDateString = (value: string | Date) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : value;

router.get("/opening-stock", authenticate, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: openingStockTable.id,
      stockItemId: openingStockTable.stockItemId,
      quantity: openingStockTable.quantity,
      effectiveDate: openingStockTable.effectiveDate,
      createdAt: openingStockTable.createdAt,
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
    .from(openingStockTable)
    .innerJoin(
      stockMasterTable,
      eq(openingStockTable.stockItemId, stockMasterTable.id),
    )
    .orderBy(openingStockTable.effectiveDate, stockMasterTable.category);
  res.json(rows);
});

router.post(
  "/opening-stock",
  authenticate,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = SetOpeningStockBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [entry] = await db
      .insert(openingStockTable)
      .values({
        stockItemId: parsed.data.stockItemId,
        quantity: String(parsed.data.quantity),
        effectiveDate: toDateString(parsed.data.effectiveDate),
      })
      .returning();
    await logAudit({
      userId: req.user!.userId,
      action: "SET_OPENING_STOCK",
      entityType: "opening_stock",
      entityId: entry.id,
      newValue: { stockItemId: entry.stockItemId, quantity: entry.quantity },
    });
    res.status(201).json(entry);
  },
);

router.post(
  "/opening-stock/import",
  authenticate,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const parsed = ImportOpeningStockBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { rows } = parsed.data;
    const effectiveDate = toDateString(parsed.data.effectiveDate);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const [item] = await db
        .select()
        .from(stockMasterTable)
        .where(eq(stockMasterTable.itemCode, row.itemCode));
      if (!item) {
        errors.push(`Item code not found: ${row.itemCode}`);
        skipped++;
        continue;
      }
      // Upsert: delete existing and insert new
      await db
        .delete(openingStockTable)
        .where(
          sql`${openingStockTable.stockItemId} = ${item.id} AND ${openingStockTable.effectiveDate} = ${effectiveDate}`,
        );
      await db.insert(openingStockTable).values({
        stockItemId: item.id,
        quantity: String(row.quantity),
        effectiveDate,
      });
      imported++;
    }

    await logAudit({
      userId: req.user!.userId,
      action: "IMPORT_OPENING_STOCK",
      entityType: "opening_stock",
      newValue: { effectiveDate, imported, skipped },
    });

    res.json({ imported, skipped, errors });
  },
);
router.patch(
  "/opening-stock/:id",
  authenticate,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);

    const quantity = Number(req.body.quantity);
    const effectiveDate = req.body.effectiveDate;

    const [updated] = await db
      .update(openingStockTable)
      .set({
        quantity: String(quantity),
        effectiveDate: toDateString(effectiveDate),
      })
      .where(eq(openingStockTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({
        error: "Opening stock entry not found",
      });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: "UPDATE_OPENING_STOCK",
      entityType: "opening_stock",
      entityId: id,
      newValue: {
        quantity: updated.quantity,
        effectiveDate: updated.effectiveDate,
      },
    });

    res.json(updated);
  },
);
router.delete(
  "/opening-stock/:id",
  authenticate,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);

    const [deleted] = await db
      .delete(openingStockTable)
      .where(eq(openingStockTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({
        error: "Opening stock entry not found",
      });
      return;
    }

    await logAudit({
      userId: req.user!.userId,
      action: "DELETE_OPENING_STOCK",
      entityType: "opening_stock",
      entityId: id,
    });

    res.json({
      success: true,
    });
  },
);
export default router;
