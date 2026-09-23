import { Skeleton, SkeletonCard } from "../components/Skeleton";

export default function HomeLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-9 w-32 rounded-full" />

      <div className="card flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-36" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="card flex flex-col items-center gap-4">
        <Skeleton className="h-3 w-32 self-start" />
        <Skeleton className="h-40 w-40 rounded-full" />
      </div>

      <div className="card flex flex-col gap-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    </main>
  );
}
