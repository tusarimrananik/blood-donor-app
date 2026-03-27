import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma.js";

const AUTH_SECRET = process.env.AUTH_SECRET || "dev-auth-secret-change-me";

type AuthTokenPayload = {
  userId: string;
  email: string;
  exp: number;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  bloodGroup: string;
  area: string;
  lastDonated: Date | null;
  gender: string | null;
  dateOfBirth: Date | null;
  profileImage: string | null;
  canDonate: boolean;
  lat: number;
  lon: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthedRequest = Request & {
  authUser?: AuthUser;
};

function base64UrlEncode(input: string) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;

  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const passwordHash = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  if (passwordHash.length !== stored.length) return false;

  return timingSafeEqual(passwordHash, stored);
}

export function signToken(userId: string, email: string) {
  const payload: AuthTokenPayload = {
    userId,
    email,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", AUTH_SECRET).update(encodedPayload).digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): AuthTokenPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = createHmac("sha256", AUTH_SECRET).update(encodedPayload).digest("base64url");
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(signature);

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AuthTokenPayload;
    if (!payload.userId || !payload.email || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function loadAuthUserById(userId: string) {
  const rows = await prisma.$queryRaw<AuthUser[]>`
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
    WHERE "id" = ${userId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

  if (!token) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }

  const user = await loadAuthUserById(payload.userId);
  if (!user) {
    return res.status(401).json({ ok: false, message: "User not found" });
  }

  req.authUser = user;
  next();
}

export async function attachAuthUser(req: AuthedRequest) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await loadAuthUserById(payload.userId);
  if (user) {
    req.authUser = user;
  }
  return user;
}
