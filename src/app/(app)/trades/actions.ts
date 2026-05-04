"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { tradeFormSchema } from "@/lib/validators";
import { calcPnL } from "@/lib/utils";
import { getOrCreateOpenPosition, recomputePosition } from "@/lib/positions";

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

function parseTagIds(formData: FormData): string[] {
  // The TagPicker submits one `tags` entry per selected tag id.
  return formData
    .getAll("tags")
    .map(String)
    .filter((s) => s.length > 0);
}

function buildTradeData(input: ReturnType<typeof tradeFormSchema.parse>) {
  const hasExit =
    input.exitPrice && input.exitPrice !== "" && input.exitDate && input.exitDate !== "";
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
  const tagIds = parseTagIds(formData);
  const trade = await prisma.$transaction(async (tx) => {
    const position = await getOrCreateOpenPosition(tx, {
      userId: user.id,
      asset: data.asset,
      assetType: data.assetType,
      direction: data.direction,
      openedAt: data.entryDate,
    });
    const created = await tx.trade.create({
      data: { ...data, userId: user.id, positionId: position.id },
    });
    if (tagIds.length > 0) {
      // Trust check: only attach tags that belong to this user.
      const validTags = await tx.tag.findMany({
        where: { id: { in: tagIds }, userId: user.id },
        select: { id: true },
      });
      await tx.tradeTag.createMany({
        data: validTags.map((t) => ({ tradeId: created.id, tagId: t.id })),
      });
    }
    await recomputePosition(tx, position.id);
    return created;
  });

  revalidatePath("/trades");
  revalidatePath("/positions");
  revalidatePath("/dashboard");
  redirect(`/trades/${trade.id}`);
}

type TradeData = ReturnType<typeof buildTradeData>;
type ExistingTrade = NonNullable<Awaited<ReturnType<typeof prisma.trade.findUnique>>>;

function diffRevisions(existing: ExistingTrade, next: TradeData) {
  const dateStr = (d: Date | null | undefined) => (d ? d.toISOString() : null);
  const fields: Array<{ fieldName: string; oldValue: string | null; newValue: string | null }> = [
    {
      fieldName: "entryPrice",
      oldValue: existing.entryPrice.toString(),
      newValue: next.entryPrice,
    },
    {
      fieldName: "exitPrice",
      oldValue: existing.exitPrice?.toString() ?? null,
      newValue: next.exitPrice,
    },
    { fieldName: "quantity", oldValue: existing.quantity.toString(), newValue: next.quantity },
    { fieldName: "direction", oldValue: existing.direction, newValue: next.direction },
    {
      fieldName: "entryDate",
      oldValue: dateStr(existing.entryDate),
      newValue: dateStr(next.entryDate),
    },
    {
      fieldName: "exitDate",
      oldValue: dateStr(existing.exitDate),
      newValue: dateStr(next.exitDate),
    },
  ];
  return fields.filter((f) => f.oldValue !== f.newValue);
}

export async function updateTrade(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await prisma.trade.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id || existing.deletedAt) {
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
  const changes = diffRevisions(existing, data);
  const tagIds = parseTagIds(formData);

  // If the asset/direction changed, the trade must move to a different open
  // position (or a new one). The previous position needs a recompute too in
  // case removing this trade closes it out.
  const assetChanged = existing.asset !== data.asset || existing.direction !== data.direction;

  await prisma.$transaction(async (tx) => {
    let positionId = existing.positionId;
    if (assetChanged || !positionId) {
      const newPosition = await getOrCreateOpenPosition(tx, {
        userId: user.id,
        asset: data.asset,
        assetType: data.assetType,
        direction: data.direction,
        openedAt: data.entryDate,
      });
      positionId = newPosition.id;
    }

    await tx.trade.update({ where: { id }, data: { ...data, positionId } });
    if (changes.length > 0) {
      await tx.tradeRevision.createMany({
        data: changes.map((c) => ({ ...c, tradeId: id, userId: user.id })),
      });
    }
    // Replace tags wholesale: simpler than diffing, and the tradeTag join is
    // tiny per trade.
    await tx.tradeTag.deleteMany({ where: { tradeId: id } });
    if (tagIds.length > 0) {
      const validTags = await tx.tag.findMany({
        where: { id: { in: tagIds }, userId: user.id },
        select: { id: true },
      });
      await tx.tradeTag.createMany({
        data: validTags.map((t) => ({ tradeId: id, tagId: t.id })),
      });
    }
    if (assetChanged && existing.positionId && existing.positionId !== positionId) {
      await recomputePosition(tx, existing.positionId);
    }
    if (positionId) await recomputePosition(tx, positionId);
  });

  revalidatePath("/trades");
  revalidatePath(`/trades/${id}`);
  revalidatePath("/positions");
  revalidatePath("/dashboard");
  redirect(`/trades/${id}`);
}

export async function deleteTrade(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await prisma.trade.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id || existing.deletedAt) {
    return { ok: false, error: "Trade not found." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.trade.update({ where: { id }, data: { deletedAt: new Date() } });
    if (existing.positionId) await recomputePosition(tx, existing.positionId);
  });
  revalidatePath("/trades");
  revalidatePath("/positions");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function restoreTrade(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await prisma.trade.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id || !existing.deletedAt) {
    return { ok: false, error: "Trade not found." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.trade.update({ where: { id }, data: { deletedAt: null } });
    if (existing.positionId) await recomputePosition(tx, existing.positionId);
  });
  revalidatePath("/trades");
  revalidatePath("/positions");
  revalidatePath("/dashboard");
  return { ok: true };
}
