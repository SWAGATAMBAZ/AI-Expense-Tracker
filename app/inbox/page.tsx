import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeInsights } from "@/lib/ai/insights";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const insights = await computeInsights(supabase, user.id);

  return (
    <main className="flex flex-1 flex-col gap-6 pb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Financial insights from your data, refreshed as things change.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {insights.map((insight) => (
          <Link
            key={insight.key}
            href={`/ai?new=1&insight=${insight.key}`}
            className="card flex flex-col gap-2 transition-colors hover:bg-[var(--color-surface-muted)]"
          >
            <span className="card-label">Insight</span>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{insight.title}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{insight.message}</p>
            <span className="mt-1 text-xs font-medium text-[var(--color-primary)]">Discuss with AI &rarr;</span>
          </Link>
        ))}
      </div>

      <Link href="/home" className="text-sm font-medium text-[var(--color-text-secondary)]">
        &larr; Back home
      </Link>
    </main>
  );
}
