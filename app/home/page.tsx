import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const displayName = user?.user_metadata?.full_name || user?.email;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">AI Expense Tracker</h1>
      <p className="text-sm text-[var(--color-text-secondary)]">
        {user ? `Welcome back, ${displayName}.` : "Welcome."} Dashboard features start in
        Phase 4.
      </p>
      <Link href="/transactions" className="text-sm font-medium text-[var(--color-primary)]">
        View your transactions
      </Link>
      <Link href="/recurring" className="text-sm font-medium text-[var(--color-primary)]">
        View recurring expenses
      </Link>
      <Link href="/profile" className="text-sm font-medium text-[var(--color-primary)]">
        View your profile
      </Link>
      <form action={signOut}>
        <button type="submit" className="btn-secondary">
          Sign out
        </button>
      </form>
    </main>
  );
}
