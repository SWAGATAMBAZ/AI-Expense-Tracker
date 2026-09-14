"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { skipRecurringExpenseCycle } from "@/app/actions/recurring";

export function SkipCycleButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSkip() {
    setError(null);
    startTransition(async () => {
      const result = await skipRecurringExpenseCycle(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleSkip}
        disabled={isPending}
        className="text-sm font-medium text-[var(--color-text-secondary)] disabled:opacity-60"
      >
        {isPending ? "Skipping…" : "Skip this cycle"}
      </button>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
