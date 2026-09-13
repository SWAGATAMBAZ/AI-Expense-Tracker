import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">AI Expense Tracker</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Understand your spending, effortlessly — let AI categorize and track it for
          you.
        </p>
      </div>

      <div className="card flex w-full items-end justify-center gap-3 py-8" aria-hidden="true">
        <div className="h-12 w-6 rounded-t-md bg-[var(--color-border)]" />
        <div className="h-20 w-6 rounded-t-md bg-[var(--color-primary)]" />
        <div className="h-8 w-6 rounded-t-md bg-[var(--color-border)]" />
        <div className="h-28 w-6 rounded-t-md bg-[var(--color-accent)]" />
        <div className="h-16 w-6 rounded-t-md bg-[var(--color-primary)]" />
      </div>

      <div className="flex w-full flex-col gap-3">
        <Link href="/register" className="btn-primary text-center">
          Get started
        </Link>
        <Link href="/login" className="btn-secondary text-center">
          Log in
        </Link>
      </div>
    </main>
  );
}
