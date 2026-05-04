import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isDev = process.env.NODE_ENV === "development";
const debugQueries = process.env.PRISMA_DEBUG === "1";

function makeClient() {
  const client = new PrismaClient({
    log: debugQueries
      ? [
          { emit: "event", level: "query" },
          { emit: "stdout", level: "warn" },
          { emit: "stdout", level: "error" },
        ]
      : isDev
        ? ["error", "warn"]
        : ["error"],
  });

  if (debugQueries) {
    // Per-query timing — flag slow ones so we can see at a glance
    // which queries dominate a request.
    (
      client as unknown as {
        $on: (event: "query", cb: (e: Prisma.QueryEvent) => void) => void;
      }
    ).$on("query", (e) => {
      const slow = e.duration >= 200 ? " ⚠ SLOW" : "";
      // eslint-disable-next-line no-console
      console.log(`[prisma ${e.duration}ms]${slow} ${e.query}`);
    });
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
