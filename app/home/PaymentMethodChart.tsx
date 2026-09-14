"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatAmount } from "@/lib/transactions/format";
import { getChartColor, CHART_TOOLTIP_STYLE } from "./chartTheme";
import type { PaymentMethodMixItem } from "@/lib/dashboard/aggregate";

export function PaymentMethodChart({
  items,
  currency,
}: {
  items: PaymentMethodMixItem[];
  currency: string;
}) {
  if (items.length === 0) {
    return (
      <div className="card flex flex-col gap-2">
        <h2 className="card-label">Payment method mix</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          No expenses recorded for this period yet.
        </p>
      </div>
    );
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="card flex flex-col gap-3">
      <h2 className="card-label">Payment method mix</h2>

      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={items}
              dataKey="amount"
              nameKey="method"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              stroke="none"
            >
              {items.map((item, index) => (
                <Cell key={item.method} fill={getChartColor(index)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value) => formatAmount(Number(value), currency)}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-[var(--color-text-secondary)]">Total</span>
          <span className="text-base font-bold tabular-nums text-[var(--color-text-primary)]">
            {formatAmount(total, currency)}
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={item.method} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-[var(--color-text-secondary)]">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getChartColor(index) }}
              />
              {item.method}
            </span>
            <span className="font-medium tabular-nums text-[var(--color-text-primary)]">
              {formatAmount(item.amount, currency)}{" "}
              <span className="font-normal text-[var(--color-text-muted)]">
                ({item.percentage.toFixed(0)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
