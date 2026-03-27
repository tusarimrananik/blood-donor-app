import { randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

function isExpoPushToken(token: string) {
  return /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(token);
}

export async function createNotification(params: {
  recipientId: string;
  actorId?: string | null;
  requestId?: string | null;
  type: string;
  title: string;
  body: string;
}) {
  await prisma.$executeRaw`
    INSERT INTO "notifications" (
      "id",
      "recipientId",
      "actorId",
      "requestId",
      "type",
      "title",
      "body",
      "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${params.recipientId},
      ${params.actorId ?? null},
      ${params.requestId ?? null},
      ${params.type},
      ${params.title},
      ${params.body},
      NOW()
    )
  `;
}

export async function sendPushToUser(params: {
  recipientId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  const rows = await prisma.$queryRaw<Array<{ token: string }>>`
    SELECT "token"
    FROM "push_tokens"
    WHERE "donorId" = ${params.recipientId}
      AND "disabledAt" IS NULL
  `;

  const messages = rows
    .map((row: { token: string }) => row.token)
    .filter((token: string) => isExpoPushToken(token))
    .map((token: string) => ({
      to: token,
      sound: "default",
      title: params.title,
      body: params.body,
      data: params.data ?? {},
    }));

  if (!messages.length) return;

  try {
    await fetch(EXPO_PUSH_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error("Push notification send failed:", error);
  }
}

export async function notifyUser(params: {
  recipientId: string | null | undefined;
  actorId?: string | null;
  requestId?: string | null;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  if (!params.recipientId) return;

  await createNotification({
    recipientId: params.recipientId,
    actorId: params.actorId ?? null,
    requestId: params.requestId ?? null,
    type: params.type,
    title: params.title,
    body: params.body,
  });

  await sendPushToUser({
    recipientId: params.recipientId,
    title: params.title,
    body: params.body,
    data: params.data ?? {},
  });
}
