"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const IANA_TZ = /^[A-Za-z]+(?:[_/-][A-Za-z0-9_+-]+)*$/;

export async function captureTimezone(timezone: string) {
  if (!IANA_TZ.test(timezone) || timezone.length > 64) return;
  const user = await requireUser();
  if (user.timezone) return;
  await prisma.user.update({ where: { id: user.id }, data: { timezone } });
}
