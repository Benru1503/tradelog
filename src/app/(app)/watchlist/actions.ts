"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { watchItemFormSchema } from "@/lib/validators";

export type WatchlistResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createWatchItem(formData: FormData): Promise<WatchlistResult> {
  const user = await requireUser();
  const raw = {
    asset: String(formData.get("asset") ?? "").toUpperCase(),
    assetType: String(formData.get("assetType") ?? ""),
    targetPrice: String(formData.get("targetPrice") ?? ""),
    targetDirection: String(formData.get("targetDirection") ?? "") || undefined,
    note: String(formData.get("note") ?? "") || null,
  };
  const parsed = watchItemFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const targetPriceVal =
    parsed.data.targetPrice && parsed.data.targetPrice !== ""
      ? parsed.data.targetPrice
      : null;
  // A direction without a price can't alert anything, so drop it. Validator
  // already enforces the reverse (price without direction is rejected upstream).
  const targetDirectionVal = targetPriceVal
    ? (parsed.data.targetDirection ?? null)
    : null;

  try {
    await prisma.watchItem.create({
      data: {
        userId: user.id,
        asset: parsed.data.asset,
        assetType: parsed.data.assetType,
        targetPrice: targetPriceVal,
        targetDirection: targetDirectionVal,
        note: parsed.data.note ?? null,
      },
    });
  } catch (err) {
    // Prisma unique constraint => the user already watches this asset.
    if (err instanceof Error && err.message.includes("Unique")) {
      return {
        ok: false,
        error: `${parsed.data.asset} is already in your watchlist.`,
      };
    }
    throw err;
  }

  revalidatePath("/watchlist");
  return { ok: true };
}

export async function deleteWatchItem(id: string): Promise<WatchlistResult> {
  const user = await requireUser();
  const existing = await prisma.watchItem.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Watch item not found." };
  }
  await prisma.watchItem.delete({ where: { id } });
  revalidatePath("/watchlist");
  return { ok: true };
}
