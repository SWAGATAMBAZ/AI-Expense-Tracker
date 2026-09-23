import { Skeleton, SkeletonList } from "../components/Skeleton";

export default function TransactionsLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-12" />
      </div>
      <SkeletonList rows={6} />
    </main>
  );
}
