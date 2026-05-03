import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const COLUMNS = [
  "id",
  "asset",
  "assetType",
  "direction",
  "entryPrice",
  "exitPrice",
  "quantity",
  "entryDate",
  "exitDate",
  "status",
  "pnl",
  "pnlPercent",
  "fees",
  "isShared",
  "notes",
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = value instanceof Date ? value.toISOString() : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const user = await requireUser();
  const trades = await prisma.trade.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { entryDate: "desc" },
  });

  const lines = [COLUMNS.join(",")];
  for (const t of trades) {
    lines.push(COLUMNS.map((c) => csvCell((t as Record<string, unknown>)[c])).join(","));
  }
  const csv = lines.join("\n") + "\n";

  const filename = `tradelog-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
