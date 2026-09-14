"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecurringExpense } from "@/app/actions/recurring";

export function DeleteRecurringExpenseButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRecurringExpense(id);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-[var(--color-danger)]"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-[var(--color-text-secondary)]">Delete this recurring expense?</p>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={handleDelete} disabled={isPending} className="btn-danger">
          {isPending ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
