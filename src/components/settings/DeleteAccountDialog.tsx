"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { deleteAccount } from "@/app/(app)/settings/actions";

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount(confirmation);
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  }

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete account
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded border border-loss/40 bg-loss/5 p-4">
      <p className="text-sm">
        This permanently deletes your account, all trades, tags, edit history, and screenshots.
        It cannot be undone.
      </p>
      <div className="space-y-1">
        <Label htmlFor="confirm">Type <code className="font-mono">DELETE</code> to confirm</Label>
        <Input
          id="confirm"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
        />
      </div>
      {error && <p className="text-sm text-loss">{error}</p>}
      <div className="flex gap-2">
        <Button
          variant="danger"
          onClick={handleConfirm}
          disabled={pending || confirmation !== "DELETE"}
        >
          {pending ? "Deleting…" : "Delete forever"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
