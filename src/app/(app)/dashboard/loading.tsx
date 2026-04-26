import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      <Skeleton className="h-72" />
      <Skeleton className="h-64" />
    </div>
  );
}
