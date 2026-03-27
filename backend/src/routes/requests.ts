import { Router } from "express";
import { z } from "zod";
import type { AuthedRequest } from "../auth.js";
import { attachAuthUser, requireAuth } from "../auth.js";
import { notifyUser } from "../notifications.js";
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

type RequestVolunteerRow = {
  id: string;
  requestId: string;
  donorId: string;
  donorName: string;
  donorPhone: string;
  donorArea: string;
  donorBloodGroup: string;
  donorImage: string | null;
  createdAt: Date;
};

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

function effectiveStatus(status: string, donorId: string | null) {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "ASSIGNED" && donorId) return "ASSIGNED";
  return "OPEN";
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
      items: items.map((item: typeof items[number]) => ({
        ...item,
        status: effectiveStatus(item.status, item.donorId),
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
        donorId: string | null;
        status: string;
        message: string | null;
        createdAt: Date;
        responseCount: bigint;
        targetDonorName: string | null;
        volunteers: RequestVolunteerRow[];
      }>
    >`
      SELECT
        r."id",
        r."bloodGroup",
        r."area",
        r."hospital",
        r."urgency",
        r."donorId",
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

    const volunteerRows = await prisma.$queryRaw<RequestVolunteerRow[]>`
      SELECT
        rr."id",
        rr."requestId",
        rr."donorId",
        donor."name" AS "donorName",
        donor."phone" AS "donorPhone",
        donor."area" AS "donorArea",
        donor."bloodGroup" AS "donorBloodGroup",
        donor."profileImage" AS "donorImage",
        rr."createdAt"
      FROM "request_responses" rr
      INNER JOIN "requests" r ON r."id" = rr."requestId"
      INNER JOIN "donors" donor ON donor."id" = rr."donorId"
      WHERE r."createdById" = ${user.id}
      ORDER BY rr."createdAt" DESC
    `;

    const volunteersByRequest = new Map<string, RequestVolunteerRow[]>();
    for (const row of volunteerRows) {
      const current = volunteersByRequest.get(row.requestId) ?? [];
      current.push(row);
      volunteersByRequest.set(row.requestId, current);
    }

    const requestsForMe = await prisma.$queryRaw<
      Array<{
        id: string;
        requesterName: string;
        requesterPhone: string;
        bloodGroup: string;
        area: string | null;
        hospital: string | null;
        urgency: string;
        donorId: string | null;
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
        r."donorId",
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
        donorId: string | null;
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
        r."donorId",
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
      myRequests: myRequests.map((item: typeof myRequests[number]) => ({
        ...item,
        status: effectiveStatus(item.status, item.donorId),
        responseCount: Number(item.responseCount ?? 0n),
        volunteers: volunteersByRequest.get(item.id) ?? [],
      })),
      requestsForMe: requestsForMe.map((item: typeof requestsForMe[number]) => ({
        ...item,
        status: effectiveStatus(item.status, item.donorId),
      })),
      myResponses: myResponses.map((item: typeof myResponses[number]) => ({
        ...item,
        status: effectiveStatus(item.status, item.donorId),
      })),
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

    if (data.targetDonorId) {
      await notifyUser({
        recipientId: data.targetDonorId,
        actorId: user.id,
        requestId: rows[0]!.id,
        type: "REQUEST_RECEIVED",
        title: "New direct blood request",
        body: `${user.name} requested ${data.bloodGroup} blood in ${data.area}.`,
        data: { requestId: rows[0]!.id, type: "REQUEST_RECEIVED" },
      });
    }

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
        requesterName: string;
        status: string;
      }>
    >`
      SELECT "id", "bloodGroup", "createdById", "requesterName", "status"
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

    await notifyUser({
      recipientId: request.createdById,
      actorId: user.id,
      requestId,
      type: "REQUEST_RESPONSE",
      title: "A donor responded",
      body: `${user.name} volunteered for your ${request.bloodGroup} request.`,
      data: { requestId, type: "REQUEST_RESPONSE" },
    });

    return res.status(201).json({ ok: true, message: "You volunteered for this request" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

requestsRouter.post("/:id/accept", requireAuth, async (req: AuthedRequest, res) => {
  const requestId = String(req.params.id || "").trim();
  const user = req.authUser!;

  if (!requestId) {
    return res.status(400).json({ ok: false, message: "Missing request id" });
  }

  try {
    const requestRows = await prisma.$queryRaw<
      Array<{
        id: string;
        targetDonorId: string | null;
        donorId: string | null;
        createdById: string | null;
        status: string;
      }>
    >`
      SELECT "id", "targetDonorId", "donorId", "createdById", "status"
      FROM "requests"
      WHERE "id" = ${requestId}
      LIMIT 1
    `;

    const request = requestRows[0];
    if (!request) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    if (request.targetDonorId !== user.id) {
      return res.status(403).json({ ok: false, message: "Only the requested donor can accept this request" });
    }

    if (effectiveStatus(request.status, request.donorId) !== "OPEN") {
      return res.status(400).json({ ok: false, message: "This request is no longer open" });
    }

    await prisma.$executeRaw`
      UPDATE "requests"
      SET
        "donorId" = ${user.id},
        "status" = 'ASSIGNED'
      WHERE "id" = ${requestId}
    `;

    await notifyUser({
      recipientId: request.createdById,
      actorId: user.id,
      requestId,
      type: "REQUEST_ACCEPTED",
      title: "Direct request accepted",
      body: `${user.name} accepted your direct blood request.`,
      data: { requestId, type: "REQUEST_ACCEPTED" },
    });

    return res.json({ ok: true, message: "Request accepted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

requestsRouter.post("/:id/cancel", requireAuth, async (req: AuthedRequest, res) => {
  const requestId = String(req.params.id || "").trim();
  const user = req.authUser!;

  if (!requestId) {
    return res.status(400).json({ ok: false, message: "Missing request id" });
  }

  try {
    const requestRows = await prisma.$queryRaw<
      Array<{
        id: string;
        createdById: string | null;
        targetDonorId: string | null;
        donorId: string | null;
        status: string;
        requesterName: string;
      }>
    >`
      SELECT "id", "createdById", "targetDonorId", "donorId", "status", "requesterName"
      FROM "requests"
      WHERE "id" = ${requestId}
      LIMIT 1
    `;

    const request = requestRows[0];
    if (!request) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    if (request.createdById !== user.id && request.targetDonorId !== user.id) {
      return res.status(403).json({ ok: false, message: "You cannot cancel this request" });
    }

    if (effectiveStatus(request.status, request.donorId) === "COMPLETED") {
      return res.status(400).json({ ok: false, message: "Completed requests cannot be cancelled" });
    }

    await prisma.$executeRaw`
      UPDATE "requests"
      SET
        "status" = 'CANCELLED',
        "donorId" = NULL
      WHERE "id" = ${requestId}
    `;

    if (request.targetDonorId === user.id && request.createdById && request.createdById !== user.id) {
      await notifyUser({
        recipientId: request.createdById,
        actorId: user.id,
        requestId,
        type: "REQUEST_DECLINED",
        title: "Direct request declined",
        body: `${user.name} declined your direct blood request.`,
        data: { requestId, type: "REQUEST_DECLINED" },
      });
    } else if (request.createdById === user.id && request.donorId) {
      await notifyUser({
        recipientId: request.donorId,
        actorId: user.id,
        requestId,
        type: "REQUEST_CANCELLED",
        title: "Request cancelled",
        body: `${user.name} cancelled the blood request.`,
        data: { requestId, type: "REQUEST_CANCELLED" },
      });
    }

    return res.json({ ok: true, message: "Request cancelled" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

requestsRouter.post("/:id/responders/:donorId/accept", requireAuth, async (req: AuthedRequest, res) => {
  const requestId = String(req.params.id || "").trim();
  const donorId = String(req.params.donorId || "").trim();
  const user = req.authUser!;

  if (!requestId || !donorId) {
    return res.status(400).json({ ok: false, message: "Missing identifiers" });
  }

  try {
    const requestRows = await prisma.$queryRaw<
      Array<{
        id: string;
        createdById: string | null;
        donorId: string | null;
        status: string;
      }>
    >`
      SELECT "id", "createdById", "donorId", "status"
      FROM "requests"
      WHERE "id" = ${requestId}
      LIMIT 1
    `;

    const request = requestRows[0];
    if (!request) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    if (request.createdById !== user.id) {
      return res.status(403).json({ ok: false, message: "Only the requester can accept a donor response" });
    }

    if (effectiveStatus(request.status, request.donorId) !== "OPEN") {
      return res.status(400).json({ ok: false, message: "This request is no longer open" });
    }

    const responseRows = await prisma.$queryRaw<Array<{ donorId: string }>>`
      SELECT "donorId"
      FROM "request_responses"
      WHERE "requestId" = ${requestId}
        AND "donorId" = ${donorId}
      LIMIT 1
    `;

    if (!responseRows[0]) {
      return res.status(404).json({ ok: false, message: "Volunteer response not found" });
    }

    await prisma.$executeRaw`
      UPDATE "requests"
      SET
        "donorId" = ${donorId},
        "status" = 'ASSIGNED'
      WHERE "id" = ${requestId}
    `;

    await notifyUser({
      recipientId: donorId,
      actorId: user.id,
      requestId,
      type: "VOLUNTEER_ACCEPTED",
      title: "You were chosen as donor",
      body: `${user.name} accepted your response to their blood request.`,
      data: { requestId, type: "VOLUNTEER_ACCEPTED" },
    });

    return res.json({ ok: true, message: "Volunteer accepted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

requestsRouter.post("/:id/responders/:donorId/decline", requireAuth, async (req: AuthedRequest, res) => {
  const requestId = String(req.params.id || "").trim();
  const donorId = String(req.params.donorId || "").trim();
  const user = req.authUser!;

  if (!requestId || !donorId) {
    return res.status(400).json({ ok: false, message: "Missing identifiers" });
  }

  try {
    const requestRows = await prisma.$queryRaw<Array<{ createdById: string | null }>>`
      SELECT "createdById"
      FROM "requests"
      WHERE "id" = ${requestId}
      LIMIT 1
    `;

    const request = requestRows[0];
    if (!request) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    if (request.createdById !== user.id) {
      return res.status(403).json({ ok: false, message: "Only the requester can decline a donor response" });
    }

    const deleted = await prisma.$executeRaw`
      DELETE FROM "request_responses"
      WHERE "requestId" = ${requestId}
        AND "donorId" = ${donorId}
    `;

    if (!deleted) {
      return res.status(404).json({ ok: false, message: "Volunteer response not found" });
    }

    await notifyUser({
      recipientId: donorId,
      actorId: user.id,
      requestId,
      type: "VOLUNTEER_DECLINED",
      title: "Response not selected",
      body: `${user.name} declined your response to their blood request.`,
      data: { requestId, type: "VOLUNTEER_DECLINED" },
    });

    return res.json({ ok: true, message: "Volunteer declined" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

requestsRouter.post("/:id/complete", requireAuth, async (req: AuthedRequest, res) => {
  const requestId = String(req.params.id || "").trim();
  const user = req.authUser!;

  if (!requestId) {
    return res.status(400).json({ ok: false, message: "Missing request id" });
  }

  try {
    const requestRows = await prisma.$queryRaw<
      Array<{
        id: string;
        createdById: string | null;
        donorId: string | null;
        donorName: string | null;
        status: string;
      }>
    >`
      SELECT r."id", r."createdById", r."donorId", donor."name" AS "donorName", r."status"
      FROM "requests"
      LEFT JOIN "donors" donor ON donor."id" = r."donorId"
      WHERE r."id" = ${requestId}
      LIMIT 1
    `;

    const request = requestRows[0];
    if (!request) {
      return res.status(404).json({ ok: false, message: "Request not found" });
    }

    if (request.createdById !== user.id) {
      return res.status(403).json({ ok: false, message: "Only the requester can complete this request" });
    }

    if (!request.donorId) {
      return res.status(400).json({ ok: false, message: "A donor must be assigned before completion" });
    }

    await prisma.$executeRaw`
      UPDATE "requests"
      SET "status" = 'COMPLETED'
      WHERE "id" = ${requestId}
    `;

    await notifyUser({
      recipientId: request.donorId,
      actorId: user.id,
      requestId,
      type: "REQUEST_COMPLETED",
      title: "Request completed",
      body: `${user.name} marked the blood request as completed.`,
      data: { requestId, type: "REQUEST_COMPLETED" },
    });

    return res.json({ ok: true, message: "Request completed" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

requestsRouter.post("/:id/withdraw", requireAuth, async (req: AuthedRequest, res) => {
  const requestId = String(req.params.id || "").trim();
  const user = req.authUser!;

  if (!requestId) {
    return res.status(400).json({ ok: false, message: "Missing request id" });
  }

  try {
    const deleted = await prisma.$executeRaw`
      DELETE FROM "request_responses"
      WHERE "requestId" = ${requestId}
        AND "donorId" = ${user.id}
    `;

    if (!deleted) {
      return res.status(404).json({ ok: false, message: "You have not responded to this request" });
    }

    const requestRows = await prisma.$queryRaw<Array<{ createdById: string | null }>>`
      SELECT "createdById"
      FROM "requests"
      WHERE "id" = ${requestId}
      LIMIT 1
    `;

    await notifyUser({
      recipientId: requestRows[0]?.createdById ?? null,
      actorId: user.id,
      requestId,
      type: "VOLUNTEER_WITHDREW",
      title: "A donor withdrew",
      body: `${user.name} withdrew from your blood request.`,
      data: { requestId, type: "VOLUNTEER_WITHDREW" },
    });

    return res.json({ ok: true, message: "Response cancelled" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});
