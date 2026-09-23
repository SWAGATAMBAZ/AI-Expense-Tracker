/**
 * Shared building block for every route's loading.tsx. Next.js renders the
 * nearest loading.tsx the instant a navigation to a server-rendered route
 * starts (via an automatic Suspense boundary around page.tsx), and swaps it
 * for the real page the moment that page's data finishes loading - so this
 * shows for exactly as long as the fetch actually takes, never longer, with
 * no timers or minimum-display logic needed here.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-[var(--color-border)] ${className}`}
    />
  );
}

/** A `.card`-shaped skeleton block, for pages built from stacked cards. */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card flex flex-col gap-3 ${className}`}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-32" />
    </div>
  );
}

/** A single list-row skeleton, for transaction/recurring/card lists. */
export function SkeletonRow() {
  return (
    <div className="card flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-5 w-16 shrink-0" />
    </div>
  );
}

/** Repeats SkeletonRow, for any page whose real content is a list. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** A form-shaped skeleton, for the add/edit transaction & recurring pages. */
export function SkeletonForm({ fields = 5 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
