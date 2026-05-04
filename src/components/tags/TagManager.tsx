"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Tag } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createTag, deleteTag } from "@/app/(app)/tags/actions";

const PRESET_COLORS = [
  "#5fd0f5",
  "#22c55e",
  "#ef4444",
  "#f59e0b",
  "#a78bfa",
  "#ec4899",
  "#34d399",
  "#94a3b8",
];

export function TagManager({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]!);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("color", color);
    startTransition(async () => {
      const result = await createTag(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  function handleDelete(id: string, label: string) {
    if (!confirm(`Delete tag "${label}"? It will be removed from all trades.`)) return;
    startTransition(async () => {
      const result = await deleteTag(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed "${label}"`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4" id="tags">
      <h2 className="text-base font-semibold">Tags</h2>
      <p className="text-sm text-fg-muted">
        Use tags to label trades by strategy, setup, or anything else you want to slice by later.
      </p>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="tag-name" className="text-xs text-fg-muted block mb-1">
            Name
          </label>
          <Input
            id="tag-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="breakout"
            maxLength={40}
            className="w-44"
          />
        </div>
        <div>
          <label className="text-xs text-fg-muted block mb-1">Color</label>
          <div className="flex gap-1.5 h-10 items-center">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `2px solid ${c}` : "none",
                  outlineOffset: "2px",
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <Button type="submit" disabled={pending || !name.trim()}>
          <Plus size={14} /> Add tag
        </Button>
      </form>
      {error && <p className="text-sm text-loss">{error}</p>}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ring-1 ring-inset"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                boxShadow: `inset 0 0 0 1px ${tag.color}55`,
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
              <button
                type="button"
                onClick={() => handleDelete(tag.id, tag.name)}
                aria-label={`Delete ${tag.name}`}
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
