import { Skeleton, SkeletonList } from "../components/Skeleton";

export default function CardsLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <Skeleton className="h-7 w-36" />

      <div className="card flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>

      <SkeletonList rows={2} />
      <SkeletonList rows={4} />
    </main>
  );
}
