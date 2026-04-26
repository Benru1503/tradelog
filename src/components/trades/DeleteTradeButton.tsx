"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteTrade } from "@/app/(app)/trades/actions";

export function DeleteTradeButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Delete this trade? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteTrade(id);
    });
  }

  return (
    <Button variant="danger" size="sm" onClick={handleClick} disabled={pending}>
      <Trash2 size={14} /> {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
