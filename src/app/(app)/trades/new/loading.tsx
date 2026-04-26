import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}
