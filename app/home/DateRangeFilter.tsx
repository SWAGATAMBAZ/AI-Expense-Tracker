"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DATE_RANGE_FILTERS, type DateRangeFilter as Filter } from "@/lib/dashboard/dateRanges";

const FILTER_LABELS: Record<Filter, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  last_month: "Last Month",
  previous_months: "Previous Months",
  custom: "Custom Range",
};

const LAST_12_MONTHS = Array.from({ length: 12 }, (_, i) => {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - (i + 2));
  const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  const label = date.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  return { value, label };
});

export function DateRangeFilter({ active, label }: { active: Filter; label: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<Filter>(active);
  const [month, setMonth] = useState(searchParams.get("month") ?? "");
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  function openPanel() {
    setPendingFilter(active);
    setMonth(searchParams.get("month") ?? "");
    setFrom(searchParams.get("from") ?? "");
    setTo(searchParams.get("to") ?? "");
    setValidationError(null);
    setOpen(true);
  }

  function applyAndClose() {
    if (pendingFilter === "custom" && (!from || !to)) {
      setValidationError("Select both a start and end date.");
      return;
    }
    if (pendingFilter === "previous_months" && !month) {
      setValidationError("Select a month.");
      return;
    }

    const params: Record<string, string> = { range: pendingFilter };
    if (pendingFilter === "previous_months") params.month = month;
    if (pendingFilter === "custom") {
      params.from = from;
      params.to = to;
    }
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) next.set(key, value);
    router.push(`/home?${next.toString()}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPanel}
        className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] shadow-sm"
      >
        {label}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="text-[var(--color-text-muted)]"
        >
          <path
            d="M2.5 4.5L6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close filter"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute left-0 top-full z-20 mt-2 flex w-72 max-w-[85vw] flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <ul className="flex flex-col gap-1">
              {DATE_RANGE_FILTERS.map((filter) => (
                <li key={filter}>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFilter(filter);
                      setValidationError(null);
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      pendingFilter === filter
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]"
                    }`}
                  >
                    {FILTER_LABELS[filter]}
                  </button>
                </li>
              ))}
            </ul>

            {pendingFilter === "previous_months" ? (
              <select
                aria-label="Select month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="input-field"
              >
                <option value="" disabled>
                  Select a month
                </option>
                {LAST_12_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : null}

            {pendingFilter === "custom" ? (
              <div className="flex flex-col gap-2">
                <div>
                  <label htmlFor="from" className="label-text">
                    From
                  </label>
                  <input
                    id="from"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="to" className="label-text">
                    To
                  </label>
                  <input
                    id="to"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
            ) : null}

            {validationError ? <p className="error-text">{validationError}</p> : null}

            <button type="button" onClick={applyAndClose} className="btn-primary">
              Done
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
