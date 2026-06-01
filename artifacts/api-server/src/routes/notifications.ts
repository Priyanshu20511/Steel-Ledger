import { Router } from "express";
import { eq, or, isNull, and, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { MarkNotificationReadParams } from "@workspace/api-zod";
import { authenticate } from "../lib/auth";

const router = Router();

router.get("/notifications", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(
      or(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.userId),
      ),
    )
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(notifications);
});

router.patch("/notifications/:id/read", authenticate, async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, params.data.id));
  res.json({ success: true });
});

router.patch("/notifications/read-all", authenticate, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      or(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.userId),
      ),
    );
  res.json({ success: true });
});

export default router;
