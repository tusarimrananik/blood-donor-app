import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../auth.js";
import { requireAuth } from "../auth.js";
import { prisma } from "../prisma.js";

export const notificationsRouter = Router();

const registerPushTokenSchema = z.object({
  token: z.string().min(1, "Push token is required"),
  platform: z.string().min(1, "Platform is required"),
});

notificationsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.authUser!;

  try {
    const notifications = await prisma.$queryRaw<
      Array<{
        id: string;
        type: string;
        title: string;
        body: string;
        readAt: Date | null;
        createdAt: Date;
        requestId: string | null;
        actorId: string | null;
        actorName: string | null;
        actorImage: string | null;
      }>
    >`
      SELECT
        n."id",
        n."type",
        n."title",
        n."body",
        n."readAt",
        n."createdAt",
        n."requestId",
        n."actorId",
        actor."name" AS "actorName",
        actor."profileImage" AS "actorImage"
      FROM "notifications" n
      LEFT JOIN "donors" actor ON actor."id" = n."actorId"
      WHERE n."recipientId" = ${user.id}
      ORDER BY n."createdAt" DESC
      LIMIT 100
    `;

    const unreadRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS "total"
      FROM "notifications"
      WHERE "recipientId" = ${user.id}
        AND "readAt" IS NULL
    `;

    return res.json({
      ok: true,
      unreadCount: Number(unreadRows[0]?.total ?? 0n),
      items: notifications,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

notificationsRouter.post("/register-token", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const parsed = registerPushTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Validation failed", errors: parsed.error.flatten() });
  }

  const { token, platform } = parsed.data;

  try {
    await prisma.$executeRaw`
      INSERT INTO "push_tokens" (
        "id",
        "donorId",
        "token",
        "platform",
        "disabledAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${user.id},
        ${token},
        ${platform},
        NULL,
        NOW(),
        NOW()
      )
      ON CONFLICT ("token") DO UPDATE
      SET
        "donorId" = EXCLUDED."donorId",
        "platform" = EXCLUDED."platform",
        "disabledAt" = NULL,
        "updatedAt" = NOW()
    `;

    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

notificationsRouter.post("/:id/read", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.authUser!;
  const notificationId = String(req.params.id || "").trim();

  if (!notificationId) {
    return res.status(400).json({ ok: false, message: "Missing notification id" });
  }

  try {
    await prisma.$executeRaw`
      UPDATE "notifications"
      SET "readAt" = COALESCE("readAt", NOW())
      WHERE "id" = ${notificationId}
        AND "recipientId" = ${user.id}
    `;

    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

notificationsRouter.post("/read-all", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.authUser!;

  try {
    await prisma.$executeRaw`
      UPDATE "notifications"
      SET "readAt" = COALESCE("readAt", NOW())
      WHERE "recipientId" = ${user.id}
        AND "readAt" IS NULL
    `;

    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});
