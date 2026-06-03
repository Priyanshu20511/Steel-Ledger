import { Router } from "express";
import { eq, ilike, or } from "drizzle-orm";

import { db, partyMasterTable } from "@workspace/db";

import { authenticate, requireRole } from "../lib/auth";
import { logAudit } from "../lib/auditLogger";

const router = Router();

// Create Router
router.get("/party-master", authenticate, async (_req, res) => {
  const parties = await db.select().from(partyMasterTable);

  res.json(parties);
});
// Post
router.post(
  "/party-master",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const { name, gstNo, phone, address } = req.body;

    if (!name?.trim()) {
      res.status(400).json({
        error: "Party name is required",
      });
      return;
    }

    const [party] = await db
      .insert(partyMasterTable)
      .values({
        name,
        gstNo,
        phone,
        address,
      })
      .returning();

    await logAudit({
      userId: req.user!.userId,
      action: "CREATE_PARTY",
      entityType: "party_master",
      entityId: party.id,
      newValue: party,
    });

    res.status(201).json(party);
  },
);
// Patch
router.patch(
  "/party-master/:id",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const id = Number(req.params.id);

    const { name, gstNo, phone, address } = req.body;

    const [existing] = await db
      .select()
      .from(partyMasterTable)
      .where(eq(partyMasterTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Party not found" });
      return;
    }

    const [updated] = await db
      .update(partyMasterTable)
      .set({
        name,
        gstNo,
        phone,
        address,
      })
      .where(eq(partyMasterTable.id, id))
      .returning();

    await logAudit({
      userId: req.user!.userId,
      action: "UPDATE_PARTY",
      entityType: "party_master",
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });

    res.json(updated);
  },
);
// DELETE_PARTY
router.delete(
  "/party-master/:id",
  authenticate,
  requireRole("admin"),
  async (req, res) => {
    const id = Number(req.params.id);

    const [existing] = await db
      .select()
      .from(partyMasterTable)
      .where(eq(partyMasterTable.id, id));

    if (!existing) {
      res.status(404).json({ error: "Party not found" });
      return;
    }

    await db.delete(partyMasterTable).where(eq(partyMasterTable.id, id));

    await logAudit({
      userId: req.user!.userId,
      action: "DELETE_PARTY",
      entityType: "party_master",
      entityId: id,
      oldValue: existing,
    });

    res.json({
      success: true,
    });
  },
);
export default router;
