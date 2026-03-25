import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../auth.js";
import { attachAuthUser, requireAuth } from "../auth.js";
import { prisma } from "../prisma.js";

export const requestsRouter = Router();

const createRequestSchema = z.object({
  bloodGroup: z.string().min(1, "Blood group is required"),
  message: z.string().min(8, "Message must be at least 8 characters"),
  area: z.string().min(1, "Area is required"),
  hospital: z.string().trim().optional(),
  urgency: z.enum(["STANDARD", "PRIORITY", "URGENT"]).default("STANDARD"),
  targetDonorId: z.string().uuid().optional(),
});

function clampInt(value: unknown, def: number, min: number, max: number) {
  const n =
    typeof value === "string"
      ? Number(value)
      : typeof value === "number"
      ? value
      : NaN;

  if (!Number.isFinite(n)) return def;

  const i = Math.trunc(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

requestsRouter.get("/", async (req: AuthedRequest, res) => {
  const limit = clampInt(req.query.limit, 20, 1, 100);
  const offset = clampInt(req.query.offset, 0, 0, 1_000_000_000);
  const currentUser = await attachAuthUser(req);

  try {
    const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS "total"
      FROM "requests"
    `;
    const total = Number(totalRows[0]?.total ?? 0n);

    const items = await prisma.$queryRaw<
      Array<{
        id: string;
        requesterName: string;
        requesterPhone: string;
        bloodGroup: string;
        message: string | null;
        area: string | null;
        hospital: string | null;
        urgency: string;
        status: string;
        targetDonorId: string | null;
        donorId: string | null;
        createdById: string | null;
        createdAt: Date;
        targetDonorName: string | null;
        assignedDonorName: string | null;
        assignedDonorArea: string | null;
        assignedDonorPhone: string | null;
        createdByName: string | null;
        createdByImage: string | null;
        responseCount: bigint;
        volunteeredByMe: boolean;
      }>
    >`
      SELECT
        r."id",
        r."requesterName",
        r."requesterPhone",
        r."bloodGroup",
        r."message",
        r."area",
        r."hospital",
        r."urgency",
        r."status",
        r."targetDonorId",
        r."donorId",
        r."createdById",
        r."createdAt",
        target."name" AS "targetDonorName",
        assigned."name" AS "assignedDonorName",
        assigned."area" AS "assignedDonorArea",
        assigned."phone" AS "assignedDonorPhone",
        creator."name" AS "createdByName",
        creator."profileImage" AS "createdByImage",
        COUNT(rr."id")::bigint AS "responseCount",
        COALESCE(BOOL_OR(rr."donorId" = ${currentUser?.id ?? null}), false) AS "volunteeredByMe"
      FROM "requests" r
      LEFT JOIN "donors" target ON target."id" = r."targetDonorId"
      LEFT JOIN "donors" assigned ON assigned."id" = r."donorId"
      LEFT JOIN "donors" creator ON creator."id" = r."createdById"
      LEFT JOIN "request_responses" rr ON rr."requestId" = r."id"
      GROUP BY
        r."id",
        target."name",
        assigned."name",
        assigned."area",
        assigned."phone",
        creator."name",
        creator."profileImage"
      ORDER BY r."createdAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return res.json({
      ok: true,
      total,
      items: items.map((item) => ({
        ...item,
        responseCount: Number(item.responseCount ?? 0n),
      })),
      limit,
      offset,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

requestsRouter.get("/activity", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.authUser!;

  try {
    const myRequests = await prisma.$queryRaw<
      Array<{
        id: string;
        bloodGroup: string;
        area: string | null;
        hospital: string | null;
        urgency: string;
        status: string;
        message: string | null;
        createdAt: Date;
        responseCount: bigint;
        targetDonorName: string | null;
      }>
    >`
      SELECT
        r."id",
        r."bloodGroup",
        r."area",
        r."hospital",
        r."urgency",
        r."status",
        r."message",
        r."createdAt",
        COUNT(rr."id")::bigint AS "responseCount",
        target."name" AS "targetDonorName"
      FROM "requests" r
      LEFT JOIN "request_responses" rr ON rr."requestId" = r."id"
      LEFT JOIN "donors" target ON target."id" = r."targetDonorId"
      WHERE r."createdById" = ${user.id}
      GROUP BY r."id", target."name"
      ORDER BY r."createdAt" DESC
    `;

    const requestsForMe = await prisma.$queryRaw<
      Array<{
        id: string;
        requesterName: string;
        requesterPhone: string;
        bloodGroup: string;
        area: string | null;
        hospital: string | null;
        urgency: string;
        status: string;
        message: string | null;
        createdAt: Date;
      }>
    >`
      SELECT
        r."id",
        r."requesterName",
        r."requesterPhone",
        r."bloodGroup",
        r."area",
        r."hospital",
        r."urgency",
        r."status",
        r."message",
        r."createdAt"
      FROM "requests" r
      WHERE r."targetDonorId" = ${user.id}
      ORDER BY r."createdAt" DESC
    `;

    const myResponses = await prisma.$queryRaw<
      Array<{
        id: string;
        requestId: string;
        requesterName: string;
        bloodGroup: string;
        area: string | null;
        hospital: string | null;
        urgency: string;
        status: string;
        message: string | null;
        createdAt: Date;
        volunteeredAt: Date;
      }>
    >`
      SELECT
        rr."id",
        rr."requestId",
        r."requesterName",
        r."bloodGroup",
        r."area",
        r."hospital",
        r."urgency",
        r."status",
        r."message",
        r."createdAt",
        rr."createdAt" AS "volunteeredAt"
      FROM "request_responses" rr
      INNER JOIN "requests" r ON r."id" = rr."requestId"
      WHERE rr."donorId" = ${user.id}
      ORDER BY rr."createdAt" DESC
    `;

    return res.json({
      ok: true,
      myRequests: myRequests.map((item) => ({ ...item, responseCount: Number(item.responseCount ?? 0n) })),
      requestsForMe,
      myResponses,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

requestsRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: "Validation failed", errors: parsed.error.flatten() });
  }

  const user = req.authUser!;
  const data = parsed.data;

  try {
    if (data.targetDonorId) {
      const targetRows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "donors"
        WHERE "id" = ${data.targetDonorId}
        LIMIT 1
      `;

      if (!targetRows[0]) {
        return res.status(404).json({ ok: false, message: "Target donor not found" });
      }

      if (data.targetDonorId === user.id) {
        return res.status(400).json({ ok: false, message: "You cannot target your own donor profile" });
      }
    }

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "requests" (
        "id",
        "requesterName",
        "requesterPhone",
        "bloodGroup",
        "message",
        "area",
        "hospital",
        "urgency",
        "status",
        "targetDonorId",
        "createdById",
        "createdAt"
      )
      VALUES (
        gen_random_uuid(),
        ${user.name},
        ${user.phone},
        ${data.bloodGroup},
        ${data.message},
        ${data.area},
        ${data.hospital},
        ${data.urgency},
        'OPEN',
        ${data.targetDonorId ?? null},
        ${user.id},
        NOW()
      )
      RETURNING "id"
    `;

    return res.status(201).json({ ok: true, requestId: rows[0]!.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

requestsRouter.post("/:id/respond", requireAuth, async (req: AuthedRequest, res) => {
  const requestId = String(req.params.id || "").trim();
  const user = req.authUser!;

  if (!requestId) {
    return res.status(400).json({ ok: false, message: "Missing request id" });
  }

  if (!user.canDonate) {
    return res.status(400).json({ ok: false, message: "Turn on donation availability in your profile first" });
  }

  try {
    const requestRows = await prisma.$queryRaw<
      Array<{
        id: string;
        bloodGroup: string;
        createdById: string | null;
        status: string;
      }>
    >`
      SELECT "id", "bloodGroup", "createdById", "status"
      FROM "requests"
      WHERE "id" = ${requestId}
      LIMIT 1
    `;

    const request = requestRows[0];
    if (!request) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    if (request.createdById === user.id) {
      return res.status(400).json({ ok: false, message: "You cannot volunteer for your own request" });
    }

    if (request.status !== "OPEN") {
      return res.status(400).json({ ok: false, message: "This request is no longer open" });
    }

    if (request.bloodGroup !== user.bloodGroup) {
      return res.status(400).json({ ok: false, message: "Your blood group does not match this request" });
    }

    await prisma.$executeRaw`
      INSERT INTO "request_responses" (
        "id",
        "requestId",
        "donorId",
        "createdAt"
      )
      VALUES (
        gen_random_uuid(),
        ${requestId},
        ${user.id},
        NOW()
      )
      ON CONFLICT ("requestId", "donorId") DO NOTHING
    `;

    return res.status(201).json({ ok: true, message: "You volunteered for this request" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});
