"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteAccount(confirmation: string): Promise<{ ok: boolean; error?: string }> {
  if (confirmation !== "DELETE") {
    return { ok: false, error: 'Type DELETE to confirm.' };
  }

  const user = await requireUser();

  await prisma.user.delete({ where: { id: user.id } });

  const admin = createAdminClient();
  const { error: adminErr } = await admin.auth.admin.deleteUser(user.id);
  if (adminErr) {
    console.error("[deleteAccount] supabase admin deleteUser failed", {
      userId: user.id,
      error: adminErr.message,
    });
    return { ok: false, error: "Account data deleted, but auth removal failed. Contact the operator." };
  }

  const supabase = createClient();
  await supabase.auth.signOut();

  redirect("/");
}
