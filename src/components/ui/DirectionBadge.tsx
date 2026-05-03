import { cn } from "@/lib/utils";

type Direction = "LONG" | "SHORT";

export function DirectionBadge({
  direction,
  size = "md",
  className,
}: {
  direction: Direction;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold tracking-wider uppercase",
        sizeClass,
        direction === "LONG"
          ? "bg-profit/10 text-profit ring-1 ring-inset ring-profit/25"
          : "bg-loss/10 text-loss ring-1 ring-inset ring-loss/25",
        className,
      )}
    >
      {direction}
    </span>
  );
}
