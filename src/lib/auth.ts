import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// React's cache() dedupes within a single request — layout, page, and any
// server actions in the same render all share one DB roundtrip instead of
// each doing their own.
//
// Hot path: findUnique only. The user row was created by /auth/callback when
// the session was exchanged, so 99.9% of the time it already exists. Falling
// through to upsert keeps us race-safe for the very first hit (or if the row
// was manually deleted).
export const requireUser = cache(async () => {
  const h = headers();
  const userId = h.get("x-user-id");
  if (!userId) redirect("/login");

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing) return existing;

  return prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: h.get("x-user-email") ?? "",
      displayName: h.get("x-user-name") ?? null,
      avatarUrl: h.get("x-user-avatar") ?? null,
    },
  });
});

export function getSessionUserId() {
  return headers().get("x-user-id");
}
