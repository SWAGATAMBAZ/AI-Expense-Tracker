"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import Link from "next/link";
import { formatAmount } from "@/lib/transactions/format";
import { getChartColor, CHART_TOOLTIP_STYLE, CHART_AXIS_TICK } from "./chartTheme";
import type { CategoryBreakdownItem } from "@/lib/dashboard/aggregate";

export function CategoryBreakdownChart({
  items,
  currency,
}: {
  items: CategoryBreakdownItem[];
  currency: string;
}) {
  if (items.length === 0) {
    return (
      <div className="card flex flex-col gap-2">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
          Spending by category
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          No expenses recorded for this period yet.
        </p>
        <Link href="/transactions/new" className="text-sm font-medium text-[var(--color-primary)]">
          Add an expense
        </Link>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3">
      <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
        Spending by category
      </h2>

      <ResponsiveContainer width="100%" height={Math.max(160, items.length * 32)}>
        <BarChart data={items} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="categoryName"
            width={110}
            axisLine={false}
            tickLine={false}
            tick={CHART_AXIS_TICK}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => formatAmount(Number(value), currency)}
          />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
            {items.map((item, index) => (
              <Cell key={item.categoryId ?? "uncategorized"} fill={getChartColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <ul className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li
            key={item.categoryId ?? "uncategorized"}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getChartColor(index) }}
              />
              {item.categoryName}
            </span>
            <span className="text-[var(--color-text-primary)]">
              {formatAmount(item.amount, currency)}{" "}
              <span className="text-[var(--color-text-muted)]">
                ({item.percentage.toFixed(0)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
