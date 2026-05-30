import { db, auditLogsTable } from "@workspace/db";

export async function logAudit(params: {
  userId: number;
  action: string;
  entityType?: string;
  entityId?: number;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  await db.insert(auditLogsTable).values({
    userId: params.userId,
    action: params.action,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    oldValue: params.oldValue != null ? JSON.stringify(params.oldValue) : null,
    newValue: params.newValue != null ? JSON.stringify(params.newValue) : null,
  });
}
