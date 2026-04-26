import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Fast path: middleware already validated the session and set x-user-id.
 * No second getUser() round-trip, no upsert per request.
 *
 * The user row is created/updated by /auth/callback when the session is
 * exchanged. If we ever land here without a row (manual DB delete, race),
 * we fall through to a one-shot create from the verified middleware headers.
 */
export async function requireUser() {
  const h = headers();
  const userId = h.get("x-user-id");
  if (!userId) redirect("/login");

  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: userId,
        email: h.get("x-user-email") ?? "",
        displayName: h.get("x-user-name") ?? null,
        avatarUrl: h.get("x-user-avatar") ?? null,
      },
    });
  }

  return user;
}

export function getSessionUserId() {
  return headers().get("x-user-id");
}
