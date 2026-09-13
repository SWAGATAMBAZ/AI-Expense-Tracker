"use client";

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

export function DateRangeFilter({ active }: { active: Filter }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigateTo(params: Record<string, string>) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) next.set(key, value);
    router.push(`/home?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {DATE_RANGE_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => navigateTo({ range: filter })}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active === filter
                ? "border-transparent bg-[var(--color-primary)] text-white"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
            }`}
          >
            {FILTER_LABELS[filter]}
          </button>
        ))}
      </div>

      {active === "previous_months" ? (
        <select
          // Remounts when the URL param changes (e.g. browser back/forward) so
          // this uncontrolled <select> can't drift out of sync with it.
          key={searchParams.get("month") ?? ""}
          aria-label="Select month"
          defaultValue={searchParams.get("month") ?? ""}
          onChange={(e) => navigateTo({ range: "previous_months", month: e.target.value })}
          className="input-field"
        >
          <option value="" disabled>
            Select a month
          </option>
          {LAST_12_MONTHS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      ) : null}

      {active === "custom" ? (
        <CustomRangeInputs
          key={`${searchParams.get("from") ?? ""}:${searchParams.get("to") ?? ""}`}
          defaultFrom={searchParams.get("from") ?? ""}
          defaultTo={searchParams.get("to") ?? ""}
          onApply={(from, to) => navigateTo({ range: "custom", from, to })}
        />
      ) : null}
    </div>
  );
}

function CustomRangeInputs({
  defaultFrom,
  defaultTo,
  onApply,
}: {
  defaultFrom: string;
  defaultTo: string;
  onApply: (from: string, to: string) => void;
}) {
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onApply(String(formData.get("from") ?? ""), String(formData.get("to") ?? ""));
      }}
    >
      <div className="flex-1">
        <label htmlFor="from" className="label-text">
          From
        </label>
        <input id="from" name="from" type="date" defaultValue={defaultFrom} className="input-field" />
      </div>
      <div className="flex-1">
        <label htmlFor="to" className="label-text">
          To
        </label>
        <input id="to" name="to" type="date" defaultValue={defaultTo} className="input-field" />
      </div>
      <button
        type="submit"
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-muted)]"
      >
        Apply
      </button>
    </form>
  );
}
