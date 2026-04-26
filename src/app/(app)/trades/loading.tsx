import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-20 mt-2" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
