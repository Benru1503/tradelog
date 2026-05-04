"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export type TagResult = { ok: true } | { ok: false; error: string };

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/i, "Color must be a hex like #5fd0f5"),
});

export async function createTag(formData: FormData): Promise<TagResult> {
  const user = await requireUser();
  const parsed = createTagSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    color: String(formData.get("color") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  try {
    await prisma.tag.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        color: parsed.data.color.toLowerCase(),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique")) {
      return { ok: false, error: `Tag "${parsed.data.name}" already exists.` };
    }
    throw err;
  }
  revalidatePath("/settings");
  revalidatePath("/trades");
  return { ok: true };
}

export async function deleteTag(id: string): Promise<TagResult> {
  const user = await requireUser();
  const existing = await prisma.tag.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Tag not found." };
  }
  await prisma.tag.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/trades");
  return { ok: true };
}
