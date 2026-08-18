import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    });
  } catch (err) {
    // This route is public — uptime probes and the Vercel cron carry no
    // session — so the response must not describe the database. Prisma's
    // message names the pooler host and port; that stays in the server log.
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[health] database check failed:", detail);
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: process.env.NODE_ENV === "production" ? "Database unreachable" : detail,
      },
      { status: 503 },
    );
  }
}
