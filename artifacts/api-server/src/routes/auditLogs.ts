import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { ListAuditLogsQueryParams } from "@workspace/api-zod";
import { authenticate, requireRole } from "../lib/auth";

const router = Router();

router.get("/audit-logs", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = ListAuditLogsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { userId, action, fromDate, toDate, limit, offset } = params.data;

  const conditions = [];
  if (userId) conditions.push(eq(auditLogsTable.userId, userId));
  if (action) conditions.push(sql`${auditLogsTable.action} ILIKE ${'%' + action + '%'}`);
  if (fromDate) conditions.push(sql`${auditLogsTable.createdAt} >= ${fromDate + 'T00:00:00Z'}`);
  if (toDate) conditions.push(sql`${auditLogsTable.createdAt} <= ${toDate + 'T23:59:59Z'}`);

  const pageLimit = limit ?? 50;
  const pageOffset = offset ?? 0;

  let countQuery = db.select({ count: sql<string>`COUNT(*)` }).from(auditLogsTable).$dynamic();
  let rowsQuery = db
    .select({
      id: auditLogsTable.id,
      userId: auditLogsTable.userId,
      action: auditLogsTable.action,
      entityType: auditLogsTable.entityType,
      entityId: auditLogsTable.entityId,
      oldValue: auditLogsTable.oldValue,
      newValue: auditLogsTable.newValue,
      createdAt: auditLogsTable.createdAt,
      userName: usersTable.name,
    })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .$dynamic();

  if (conditions.length > 0) {
    const where = and(...conditions);
    countQuery = countQuery.where(where!);
    rowsQuery = rowsQuery.where(where!);
  }

  const [countResult] = await countQuery;
  const rows = await rowsQuery.orderBy(desc(auditLogsTable.createdAt)).limit(pageLimit).offset(pageOffset);

  res.json({ rows, total: parseInt(countResult?.count ?? "0") });
});

export default router;
