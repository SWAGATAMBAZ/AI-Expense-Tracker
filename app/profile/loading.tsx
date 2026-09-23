import { Skeleton, SkeletonForm } from "../components/Skeleton";

export default function ProfileLoading() {
  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-48" />
      </div>
      <SkeletonForm fields={5} />
      <Skeleton className="h-10 w-full" />
    </main>
  );
}
