"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { tradeFormSchema } from "@/lib/validators";
import { calcPnL } from "@/lib/utils";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function parseFormData(formData: FormData) {
  const raw = {
    asset: String(formData.get("asset") ?? ""),
    assetType: String(formData.get("assetType") ?? ""),
    direction: String(formData.get("direction") ?? ""),
    entryPrice: String(formData.get("entryPrice") ?? ""),
    exitPrice: String(formData.get("exitPrice") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    entryDate: String(formData.get("entryDate") ?? ""),
    exitDate: String(formData.get("exitDate") ?? ""),
    fees: String(formData.get("fees") ?? "0"),
    notes: String(formData.get("notes") ?? "") || null,
    isShared: formData.get("isShared") === "on",
  };
  return tradeFormSchema.safeParse(raw);
}

function buildTradeData(input: ReturnType<typeof tradeFormSchema.parse>) {
  const hasExit = input.exitPrice && input.exitPrice !== "" && input.exitDate && input.exitDate !== "";
  const entryPrice = new Decimal(input.entryPrice);
  const quantity = new Decimal(input.quantity);
  const fees = new Decimal(input.fees);

  let pnl: Decimal | null = null;
  let pnlPercent: Decimal | null = null;
  let exitPrice: Decimal | null = null;

  if (hasExit) {
    exitPrice = new Decimal(input.exitPrice as string);
    const computed = calcPnL({
      entryPrice,
      exitPrice,
      quantity,
      fees,
      direction: input.direction,
    });
    pnl = computed?.pnl ?? null;
    pnlPercent = computed?.pnlPercent ?? null;
  }

  return {
    asset: input.asset.toUpperCase(),
    assetType: input.assetType,
    direction: input.direction,
    entryPrice: entryPrice.toString(),
    exitPrice: exitPrice ? exitPrice.toString() : null,
    quantity: quantity.toString(),
    entryDate: new Date(input.entryDate),
    exitDate: hasExit ? new Date(input.exitDate as string) : null,
    status: hasExit ? ("CLOSED" as const) : ("OPEN" as const),
    pnl: pnl ? pnl.toString() : null,
    pnlPercent: pnlPercent ? pnlPercent.toString() : null,
    fees: fees.toString(),
    notes: input.notes ?? null,
    isShared: input.isShared,
  };
}

export async function createTrade(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = buildTradeData(parsed.data);
  const trade = await prisma.trade.create({
    data: { ...data, userId: user.id },
  });

  revalidatePath("/trades");
  revalidatePath("/dashboard");
  redirect(`/trades/${trade.id}`);
}

export async function updateTrade(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await prisma.trade.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Trade not found." };
  }

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = buildTradeData(parsed.data);
  await prisma.trade.update({ where: { id }, data });

  revalidatePath("/trades");
  revalidatePath(`/trades/${id}`);
  revalidatePath("/dashboard");
  redirect(`/trades/${id}`);
}

export async function deleteTrade(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await prisma.trade.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Trade not found." };
  }
  await prisma.trade.delete({ where: { id } });
  revalidatePath("/trades");
  revalidatePath("/dashboard");
  redirect("/trades");
}
