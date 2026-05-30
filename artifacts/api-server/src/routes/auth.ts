import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody, ChangePasswordBody, ResetPasswordBody } from "@workspace/api-zod";
import { signToken, authenticate, requireRole } from "../lib/auth";
import { logAudit } from "../lib/auditLogger";

const router = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (!user || user.status === "inactive") {
    res.status(401).json({ error: "Invalid credentials or inactive account" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken({ userId: user.id, role: user.role, username: user.username });
  await logAudit({ userId: user.id, action: "LOGIN", entityType: "user", entityId: user.id });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
});

router.post("/auth/logout", authenticate, async (req, res): Promise<void> => {
  if (req.user) {
    await logAudit({ userId: req.user.userId, action: "LOGOUT" });
  }
  res.json({ success: true });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  });
});

router.post("/auth/change-password", authenticate, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  await logAudit({ userId: user.id, action: "CHANGE_PASSWORD", entityType: "user", entityId: user.id });
  res.json({ success: true });
});

router.post("/auth/reset-password", authenticate, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { userId, newPassword } = parsed.data;
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const [updated] = await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logAudit({
    userId: req.user!.userId,
    action: "RESET_PASSWORD",
    entityType: "user",
    entityId: userId,
  });
  res.json({ success: true });
});

export default router;
