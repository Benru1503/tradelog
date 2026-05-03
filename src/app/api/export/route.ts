import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();

  const [trades, tags, revisions] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: user.id },
      include: { tags: { include: { tag: true } }, images: true },
      orderBy: { entryDate: "desc" },
    }),
    prisma.tag.findMany({ where: { userId: user.id } }),
    prisma.tradeRevision.findMany({
      where: { userId: user.id },
      orderBy: { changedAt: "desc" },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
    trades,
    tags,
    revisions,
  };

  const filename = `tradelog-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
