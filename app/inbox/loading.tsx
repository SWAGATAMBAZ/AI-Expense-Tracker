import { Skeleton, SkeletonCard } from "../components/Skeleton";

export default function InboxLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex flex-col gap-3">
        <SkeletonCard className="h-28" />
        <SkeletonCard className="h-28" />
        <SkeletonCard className="h-28" />
      </div>
    </main>
  );
}
