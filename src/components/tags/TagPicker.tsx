"use client";

import { useState } from "react";
import Link from "next/link";
import type { Tag } from "@prisma/client";
import { cn } from "@/lib/utils";

interface Props {
  tags: Tag[];
  defaultSelectedIds?: string[];
}

// Multi-select chip picker. Selected tag IDs submit as repeated `tags` form
// fields — the trades action reads them with formData.getAll("tags").
export function TagPicker({ tags, defaultSelectedIds = [] }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelectedIds));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (tags.length === 0) {
    return (
      <p className="text-xs text-fg-subtle">
        No tags yet.{" "}
        <Link href="/settings#tags" className="text-accent hover:underline">
          Create one in Settings
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const isSelected = selected.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium transition-colors ring-1 ring-inset",
              isSelected
                ? "ring-transparent text-fg"
                : "ring-border text-fg-muted hover:text-fg hover:bg-bg-elevated",
            )}
            style={
              isSelected
                ? {
                    backgroundColor: `${tag.color}25`,
                    color: tag.color,
                    boxShadow: `inset 0 0 0 1px ${tag.color}55`,
                  }
                : undefined
            }
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
          </button>
        );
      })}
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="tags" value={id} />
      ))}
    </div>
  );
}

// Read-only chip row used on the trade detail page.
export function TagChips({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset"
          style={{
            backgroundColor: `${tag.color}20`,
            color: tag.color,
            boxShadow: `inset 0 0 0 1px ${tag.color}50`,
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
            style={{ backgroundColor: tag.color }}
          />
          {tag.name}
        </span>
      ))}
    </div>
  );
}
