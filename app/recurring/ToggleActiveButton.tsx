"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleRecurringExpenseActive } from "@/app/actions/recurring";

export function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await toggleRecurringExpenseActive(id, !active);
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
        onClick={handleToggle}
        disabled={isPending}
        className="text-sm font-medium text-[var(--color-text-secondary)] disabled:opacity-60"
      >
        {isPending ? "Updating…" : active ? "Deactivate" : "Activate"}
      </button>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
