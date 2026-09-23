import { Skeleton, SkeletonList } from "../components/Skeleton";

export default function RecurringLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-12" />
      </div>

      <div className="card flex items-baseline justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-20" />
      </div>

      <SkeletonList rows={5} />
    </main>
  );
}
