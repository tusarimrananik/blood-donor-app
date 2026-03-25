import { Router } from "express";
import { prisma } from "../prisma.js";
import { createDonorSchema } from "../validators/donor.js";

export const donorsRouter = Router();

/**
 * Helpers: pagination (auto-correct)
 */
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

function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const n =
    typeof value === "string"
      ? Number(value)
      : typeof value === "number"
      ? value
      : NaN;
  return Number.isFinite(n) ? n : null;
}

function parseBloodGroup(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (v.toLowerCase() === "all") return null;
  return v;
}

/**
 * GET /donors/:id
 * - Single donor by id
 * - Does NOT enforce eligibility (details should always work)
 */
donorsRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, message: "Missing id" });

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        phone: string;
        email: string;
        profileImage: string | null;
        bloodGroup: string;
        area: string;
        lastDonated: Date;
        lat: number;
        lon: number;
        createdAt: Date;
        updatedAt: Date;
      }>
    >`
      SELECT
        "id",
        "name",
        "phone",
        "email",
        "profileImage",
        "bloodGroup",
        "area",
        "lastDonated",
        ST_Y("location")::float8 AS "lat",
        ST_X("location")::float8 AS "lon",
        "createdAt",
        "updatedAt"
      FROM "donors"
      WHERE "id" = ${id}
      LIMIT 1
    `;

    const donor = rows[0];
    if (!donor) return res.status(404).json({ ok: false, message: "Donor not found" });

    return res.json({ ok: true, donor });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/**
 * GET /donors
 * - Default: eligible-only (lastDonated ≤ now − 90 days)
 * - If eligibleOnly=0 => include ineligible donors too
 * - Pagination: ?limit=20&offset=0
 * - Optional blood group: ?bloodGroup=AB%2B
 * - Optional distance mode still supported, but frontend won't send it
 */
donorsRouter.get("/", async (req, res) => {
  const limit = clampInt(req.query.limit, 20, 1, 100);
  const offset = clampInt(req.query.offset, 0, 0, 1_000_000_000);

  const lat = parseNumber(req.query.lat);
  const lon = parseNumber(req.query.lon);
  const hasLocation = lat !== null && lon !== null;

  const bloodGroup = parseBloodGroup(req.query.bloodGroup);
  const hasBloodFilter = typeof bloodGroup === "string";

  const eligibleOnly = String(req.query.eligibleOnly ?? "1") !== "0";

  const radiusKm = 10;
  const radiusMeters = radiusKm * 1000;

  try {
    if (!hasLocation) {
      const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*)::bigint AS "total"
        FROM "donors"
        WHERE
          "canDonate" = true
          AND
          (${eligibleOnly} = false OR "lastDonated" <= NOW() - INTERVAL '90 days')
          AND (${hasBloodFilter} = false OR "bloodGroup" = ${bloodGroup})
      `;
      const total = Number(totalRows[0]?.total ?? 0n);

      const items = await prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          phone: string;
          email: string;
          profileImage: string | null;
          bloodGroup: string;
          area: string;
          lastDonated: Date;
          lat: number;
          lon: number;
          createdAt: Date;
          updatedAt: Date;
        }>
      >`
        SELECT
          "id",
          "name",
          "phone",
          "email",
          "profileImage",
          "bloodGroup",
          "area",
          "lastDonated",
          ST_Y("location")::float8 AS "lat",
          ST_X("location")::float8 AS "lon",
          "createdAt",
          "updatedAt"
        FROM "donors"
        WHERE
          "canDonate" = true
          AND
          (${eligibleOnly} = false OR "lastDonated" <= NOW() - INTERVAL '90 days')
          AND (${hasBloodFilter} = false OR "bloodGroup" = ${bloodGroup})
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      return res.json({
        ok: true,
        total,
        items,
        limit,
        offset,
        bloodGroup: bloodGroup ?? "All",
        eligibleOnly,
      });
    }

    const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS "total"
      FROM "donors"
      WHERE
        "canDonate" = true
        AND
        (${eligibleOnly} = false OR "lastDonated" <= NOW() - INTERVAL '90 days')
        AND (${hasBloodFilter} = false OR "bloodGroup" = ${bloodGroup})
        AND ST_DistanceSphere(
          "location",
          ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
        ) <= ${radiusMeters}
    `;
    const total = Number(totalRows[0]?.total ?? 0n);

    const items = await prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          phone: string;
          email: string;
          profileImage: string | null;
          bloodGroup: string;
          area: string;
        lastDonated: Date;
        lat: number;
        lon: number;
        distanceKm: number;
        createdAt: Date;
        updatedAt: Date;
      }>
    >`
      SELECT
        "id",
        "name",
        "phone",
        "email",
        "profileImage",
        "bloodGroup",
        "area",
        "lastDonated",
        ST_Y("location")::float8 AS "lat",
        ST_X("location")::float8 AS "lon",
        (
          ST_DistanceSphere(
            "location",
            ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
          ) / 1000.0
        )::float8 AS "distanceKm",
        "createdAt",
        "updatedAt"
      FROM "donors"
      WHERE
        "canDonate" = true
        AND
        (${eligibleOnly} = false OR "lastDonated" <= NOW() - INTERVAL '90 days')
        AND (${hasBloodFilter} = false OR "bloodGroup" = ${bloodGroup})
        AND ST_DistanceSphere(
          "location",
          ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
        ) <= ${radiusMeters}
      ORDER BY "distanceKm" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return res.json({
      ok: true,
      total,
      items,
      limit,
      offset,
      radiusKm,
      center: { lat, lon },
      bloodGroup: bloodGroup ?? "All",
      eligibleOnly,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

/**
 * POST /donors
 * Body: { name, phone, email, bloodGroup, area, lastDonated: "YYYY-MM-DD", lat, lon }
 */
donorsRouter.post("/", async (req, res) => {
  const parsed = createDonorSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "Validation failed",
      errors: parsed.error.flatten(),
    });
  }

  const { name, phone, email, bloodGroup, area, lastDonated, lat, lon } = parsed.data;

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        phone: string;
        email: string;
        bloodGroup: string;
        area: string;
        lastDonated: Date;
        lat: number;
        lon: number;
        createdAt: Date;
        updatedAt: Date;
      }>
    >`
      INSERT INTO "donors"
        ("id","name","phone","email","bloodGroup","area","lastDonated","location","createdAt","updatedAt")
      VALUES
        (
          gen_random_uuid(),
          ${name},
          ${phone},
          ${email},
          ${bloodGroup},
          ${area},
          ${new Date(lastDonated + "T00:00:00.000Z")},
          ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326),
          NOW(),
          NOW()
        )
      RETURNING
        "id","name","phone","email","bloodGroup","area","lastDonated",
        ST_Y("location")::float8 as "lat",
        ST_X("location")::float8 as "lon",
        "createdAt","updatedAt"
    `;

    return res.status(201).json({ ok: true, donor: rows[0] });
  } catch (err: any) {
    if (err?.code === "23505") {
      const detail = String(err?.detail || "");
      if (detail.includes("(phone)")) return res.status(409).json({ ok: false, message: "Phone already exists" });
      if (detail.includes("(email)")) return res.status(409).json({ ok: false, message: "Email already exists" });
      return res.status(409).json({ ok: false, message: "Duplicate value" });
    }

    console.error(err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});
