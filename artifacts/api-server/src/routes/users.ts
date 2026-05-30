import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { CreateUserBody, GetUserParams, UpdateUserParams, UpdateUserBody, DeleteUserParams } from "@workspace/api-zod";
import { authenticate, requireRole } from "../lib/auth";
import { logAudit } from "../lib/auditLogger";

const router = Router();

router.get("/users", authenticate, requireRole("admin"), async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      username: usersTable.username,
      email: usersTable.email,
      mobile: usersTable.mobile,
      role: usersTable.role,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.name);
  res.json(users);
});

router.post("/users", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { password, ...rest } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({ ...rest, passwordHash })
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      username: usersTable.username,
      email: usersTable.email,
      mobile: usersTable.mobile,
      role: usersTable.role,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    });
  await logAudit({
    userId: req.user!.userId,
    action: "CREATE_USER",
    entityType: "user",
    entityId: user.id,
    newValue: { username: user.username, role: user.role },
  });
  res.status(201).json(user);
});

router.get("/users/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      username: usersTable.username,
      email: usersTable.email,
      mobile: usersTable.mobile,
      role: usersTable.role,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.patch("/users/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [old] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!old) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set(parsed.data)
    .where(eq(usersTable.id, params.data.id))
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      username: usersTable.username,
      email: usersTable.email,
      mobile: usersTable.mobile,
      role: usersTable.role,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    });
  await logAudit({
    userId: req.user!.userId,
    action: "UPDATE_USER",
    entityType: "user",
    entityId: params.data.id,
    oldValue: { role: old.role, status: old.status },
    newValue: parsed.data,
  });
  res.json(user);
});

router.delete("/users/:id", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logAudit({
    userId: req.user!.userId,
    action: "DELETE_USER",
    entityType: "user",
    entityId: params.data.id,
    oldValue: { username: deleted.username },
  });
  res.sendStatus(204);
});

export default router;
