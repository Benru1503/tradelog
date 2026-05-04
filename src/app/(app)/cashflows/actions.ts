"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { cashFlowFormSchema } from "@/lib/validators";

export type CashFlowResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createCashFlow(formData: FormData): Promise<CashFlowResult> {
  const user = await requireUser();
  const raw = {
    type: String(formData.get("type") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    currency: String(formData.get("currency") ?? "USD"),
    occurredAt: String(formData.get("occurredAt") ?? ""),
    assetSymbol: String(formData.get("assetSymbol") ?? "") || null,
    note: String(formData.get("note") ?? "") || null,
  };
  const parsed = cashFlowFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Only dividends carry an asset; drop anything sent on the other types.
  const assetSymbol = parsed.data.type === "DIVIDEND" ? parsed.data.assetSymbol : null;

  await prisma.cashFlow.create({
    data: {
      userId: user.id,
      type: parsed.data.type,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      occurredAt: new Date(parsed.data.occurredAt),
      assetSymbol,
      note: parsed.data.note ?? null,
    },
  });

  revalidatePath("/positions");
  revalidatePath("/activity");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteCashFlow(id: string): Promise<CashFlowResult> {
  const user = await requireUser();
  const existing = await prisma.cashFlow.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Cash flow not found." };
  }
  await prisma.cashFlow.delete({ where: { id } });
  revalidatePath("/positions");
  revalidatePath("/activity");
  revalidatePath("/dashboard");
  return { ok: true };
}
