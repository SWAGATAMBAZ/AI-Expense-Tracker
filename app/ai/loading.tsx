import { Skeleton } from "../components/Skeleton";

export default function AiLoading() {
  return (
    // Mirrors page.tsx's own shape (shrink-0 heading + flex-1 body) so it
    // sits correctly inside PageShell's bounded, non-scrolling /ai layout
    // instead of overflowing it.
    <main className="flex min-h-0 flex-1 flex-col">
      <Skeleton className="mb-3 h-6 w-36 shrink-0" />

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 pb-3">
        <Skeleton className="h-12 w-2/3 self-start rounded-2xl" />
        <Skeleton className="h-9 w-1/2 self-end rounded-2xl" />
        <Skeleton className="h-16 w-3/4 self-start rounded-2xl" />
      </div>

      <Skeleton className="h-12 w-full shrink-0 rounded-xl" />
    </main>
  );
}
