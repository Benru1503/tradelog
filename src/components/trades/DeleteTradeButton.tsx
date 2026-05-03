"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { deleteTrade, restoreTrade } from "@/app/(app)/trades/actions";

export function DeleteTradeButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Delete this trade? You'll have a moment to undo.")) return;
    startTransition(async () => {
      const result = await deleteTrade(id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete trade.");
        return;
      }

      router.push("/trades");
      toast("Trade deleted.", {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: async () => {
            const r = await restoreTrade(id);
            if (r.ok) {
              toast.success("Trade restored.");
              router.push(`/trades/${id}`);
            } else {
              toast.error(r.error ?? "Could not restore.");
            }
          },
        },
      });
    });
  }

  return (
    <Button variant="danger" size="sm" onClick={handleClick} disabled={pending}>
      <Trash2 size={14} /> {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
