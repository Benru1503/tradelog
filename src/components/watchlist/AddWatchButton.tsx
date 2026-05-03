"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WatchItemModal } from "./WatchItemModal";

export function AddWatchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> Add symbol
      </Button>
      <WatchItemModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
