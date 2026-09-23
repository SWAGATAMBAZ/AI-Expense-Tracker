import { Skeleton, SkeletonForm } from "../../components/Skeleton";

export default function NewRecurringExpenseLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <Skeleton className="h-7 w-52" />
      <SkeletonForm fields={6} />
    </main>
  );
}
