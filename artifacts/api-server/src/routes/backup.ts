import { Router } from "express";
import { desc } from "drizzle-orm";
import { db, backupLogsTable } from "@workspace/db";
import { authenticate, requireRole } from "../lib/auth";

const router = Router();

router.get("/backup", authenticate, requireRole("admin"), async (_req, res): Promise<void> => {
  const logs = await db.select().from(backupLogsTable).orderBy(desc(backupLogsTable.createdAt)).limit(20);
  res.json(logs);
});

router.post("/backup", authenticate, requireRole("admin"), async (_req, res): Promise<void> => {
  // Simulate a backup operation
  const [log] = await db
    .insert(backupLogsTable)
    .values({
      status: "success",
      filename: `dsms_backup_${new Date().toISOString().slice(0, 10)}.sql`,
      sizeBytes: Math.floor(Math.random() * 5000000) + 100000,
    })
    .returning();
  res.json(log);
});

export default router;
