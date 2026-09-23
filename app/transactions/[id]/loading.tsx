import { Skeleton } from "../../components/Skeleton";

export default function TransactionDetailLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <Skeleton className="h-7 w-44" />

      <dl className="card flex flex-col gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex justify-between gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </main>
  );
}
