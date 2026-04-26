import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
