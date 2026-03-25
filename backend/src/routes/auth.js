import { Router } from "express";
import { z } from "zod";
import { hashPassword, requireAuth, signToken, verifyPassword } from "../auth.js";
import { prisma } from "../prisma.js";
export const authRouter = Router();
function parseDateOnly(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match)
        return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day) {
        return null;
    }
    return date;
}
function yearsBetween(date, now = new Date()) {
    let years = now.getUTCFullYear() - date.getUTCFullYear();
    const monthDiff = now.getUTCMonth() - date.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < date.getUTCDate())) {
        years -= 1;
    }
    return years;
}
const phoneSchema = z
    .string()
    .trim()
    .regex(/^\+?\d{8,15}$/, "Phone must be 8 to 15 digits");
const dateOnlySchema = (label) => z
    .string()
    .trim()
    .refine((value) => parseDateOnly(value) !== null, `${label} must use a real YYYY-MM-DD date`);
const authSchema = z.object({
    email: z.string().trim().email("Invalid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});
const registerSchema = authSchema.extend({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    phone: phoneSchema,
    bloodGroup: z.string().min(1, "Blood group is required"),
    area: z.string().trim().min(2, "Area is required"),
    lastDonated: dateOnlySchema("Last donated").refine((value) => {
        const date = parseDateOnly(value);
        return date !== null && date.getTime() <= Date.now();
    }, "Last donated cannot be in the future"),
    gender: z.string().min(1, "Gender is required"),
    dateOfBirth: dateOnlySchema("Date of birth")
        .refine((value) => {
        const date = parseDateOnly(value);
        return date !== null && date.getTime() <= Date.now();
    }, "Date of birth cannot be in the future")
        .refine((value) => {
        const date = parseDateOnly(value);
        return date !== null && yearsBetween(date) >= 18;
    }, "You must be at least 18 years old"),
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    canDonate: z.boolean().optional(),
    profileImage: z.string().max(5_000_000).nullable().optional(),
});
const updateProfileSchema = z.object({
    name: z.string().trim().min(2).optional(),
    phone: phoneSchema.optional(),
    bloodGroup: z.string().min(1).optional(),
    area: z.string().trim().min(2).optional(),
    lastDonated: dateOnlySchema("Last donated")
        .refine((value) => {
        const date = parseDateOnly(value);
        return date !== null && date.getTime() <= Date.now();
    }, "Last donated cannot be in the future")
        .optional(),
    gender: z.string().min(1).optional(),
    dateOfBirth: dateOnlySchema("Date of birth")
        .refine((value) => {
        const date = parseDateOnly(value);
        return date !== null && date.getTime() <= Date.now();
    }, "Date of birth cannot be in the future")
        .refine((value) => {
        const date = parseDateOnly(value);
        return date !== null && yearsBetween(date) >= 18;
    }, "You must be at least 18 years old")
        .optional(),
    lat: z.number().min(-90).max(90).optional(),
    lon: z.number().min(-180).max(180).optional(),
    canDonate: z.boolean().optional(),
    profileImage: z.string().max(5_000_000).nullable().optional(),
});
async function sanitizeUserById(id) {
    const rows = await prisma.$queryRaw `
    SELECT
      "id",
      "name",
      "email",
      "phone",
      "bloodGroup",
      "area",
      "lastDonated",
      "gender",
      "dateOfBirth",
      "profileImage",
      "canDonate",
      ST_Y("location")::float8 AS "lat",
      ST_X("location")::float8 AS "lon",
      "createdAt",
      "updatedAt"
    FROM "donors"
    WHERE "id" = ${id}
    LIMIT 1
  `;
    return rows[0] ?? null;
}
authRouter.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ ok: false, message: "Validation failed", errors: parsed.error.flatten() });
    }
    const data = parsed.data;
    try {
        const inserted = await prisma.$queryRaw `
      INSERT INTO "donors" (
        "id",
        "name",
        "phone",
        "email",
        "bloodGroup",
        "area",
        "lastDonated",
        "passwordHash",
        "gender",
        "dateOfBirth",
        "profileImage",
        "canDonate",
        "location",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        ${data.name},
        ${data.phone},
        ${data.email.toLowerCase()},
        ${data.bloodGroup},
        ${data.area},
        ${new Date(`${data.lastDonated}T00:00:00.000Z`)},
        ${hashPassword(data.password)},
        ${data.gender},
        ${new Date(`${data.dateOfBirth}T00:00:00.000Z`)},
        ${data.profileImage ?? null},
        ${data.canDonate ?? true},
        ST_SetSRID(ST_MakePoint(${data.lon}, ${data.lat}), 4326),
        NOW(),
        NOW()
      )
      RETURNING "id"
    `;
        const user = await sanitizeUserById(inserted[0].id);
        const token = signToken(user.id, user.email);
        return res.status(201).json({ ok: true, token, user });
    }
    catch (err) {
        if (err?.code === "23505") {
            const detail = String(err?.detail || "");
            if (detail.includes("(phone)"))
                return res.status(409).json({ ok: false, message: "Phone already exists" });
            if (detail.includes("(email)"))
                return res.status(409).json({ ok: false, message: "Email already exists" });
            return res.status(409).json({ ok: false, message: "Duplicate value" });
        }
        console.error(err);
        return res.status(500).json({ ok: false, message: "Server error" });
    }
});
authRouter.post("/login", async (req, res) => {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ ok: false, message: "Validation failed", errors: parsed.error.flatten() });
    }
    try {
        const rows = await prisma.$queryRaw `
      SELECT "id", "email", "passwordHash"
      FROM "donors"
      WHERE LOWER("email") = ${parsed.data.email.toLowerCase()}
      LIMIT 1
    `;
        const userRow = rows[0];
        if (!userRow || !verifyPassword(parsed.data.password, userRow.passwordHash)) {
            return res.status(401).json({ ok: false, message: "Invalid email or password" });
        }
        const user = await sanitizeUserById(userRow.id);
        const token = signToken(user.id, user.email);
        return res.json({ ok: true, token, user });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, message: "Server error" });
    }
});
authRouter.get("/me", requireAuth, async (req, res) => {
    return res.json({ ok: true, user: req.authUser });
});
authRouter.patch("/me", requireAuth, async (req, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ ok: false, message: "Validation failed", errors: parsed.error.flatten() });
    }
    const user = req.authUser;
    const next = parsed.data;
    const name = next.name ?? user.name;
    const phone = next.phone ?? user.phone;
    const bloodGroup = next.bloodGroup ?? user.bloodGroup;
    const area = next.area ?? user.area;
    const lastDonated = next.lastDonated ? new Date(`${next.lastDonated}T00:00:00.000Z`) : user.lastDonated;
    const gender = next.gender ?? user.gender;
    const dateOfBirth = next.dateOfBirth ? new Date(`${next.dateOfBirth}T00:00:00.000Z`) : user.dateOfBirth;
    const profileImage = next.profileImage === undefined ? user.profileImage : next.profileImage;
    const canDonate = next.canDonate ?? user.canDonate;
    const lat = next.lat ?? user.lat;
    const lon = next.lon ?? user.lon;
    try {
        await prisma.$executeRaw `
      UPDATE "donors"
      SET
        "name" = ${name},
        "phone" = ${phone},
        "bloodGroup" = ${bloodGroup},
        "area" = ${area},
        "lastDonated" = ${lastDonated},
        "gender" = ${gender},
        "dateOfBirth" = ${dateOfBirth},
        "profileImage" = ${profileImage},
        "canDonate" = ${canDonate},
        "location" = ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326),
        "updatedAt" = NOW()
      WHERE "id" = ${user.id}
    `;
        const updatedUser = await sanitizeUserById(user.id);
        return res.json({ ok: true, user: updatedUser });
    }
    catch (err) {
        if (err?.code === "23505") {
            const detail = String(err?.detail || "");
            if (detail.includes("(phone)"))
                return res.status(409).json({ ok: false, message: "Phone already exists" });
            return res.status(409).json({ ok: false, message: "Duplicate value" });
        }
        console.error(err);
        return res.status(500).json({ ok: false, message: "Server error" });
    }
});
//# sourceMappingURL=auth.js.map