import { Skeleton, SkeletonForm } from "../../../components/Skeleton";

export default function EditTransactionLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <Skeleton className="h-7 w-40" />
      <SkeletonForm fields={7} />
    </main>
  );
}
