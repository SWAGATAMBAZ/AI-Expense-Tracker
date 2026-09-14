import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AiAssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">AI assistant</h1>

      <div className="card flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path
              d="M11 2.5l1.8 4.9 4.9 1.8-4.9 1.8-1.8 4.9-1.8-4.9-4.9-1.8 4.9-1.8L11 2.5z"
              fill="currentColor"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          AI assistant coming soon
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Soon you&apos;ll be able to describe an expense in plain language or by voice, and
          we&apos;ll record it for you automatically.
        </p>
      </div>

      <Link href="/home" className="text-sm font-medium text-[var(--color-text-secondary)]">
        &larr; Back home
      </Link>
    </main>
  );
}
