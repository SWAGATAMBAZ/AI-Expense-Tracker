import { getChartColor } from "./chartTheme";
import type { CategoryBreakdownItem } from "@/lib/dashboard/aggregate";

export function TopCategoriesCard({ items }: { items: CategoryBreakdownItem[] }) {
  const top = items.slice(0, 2);

  return (
    <div className="card flex flex-col gap-2">
      <span className="text-sm text-[var(--color-text-secondary)]">Top categories</span>
      {top.length === 0 ? (
        <span className="text-sm text-[var(--color-text-muted)]">No spending yet</span>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {top.map((item, index) => (
            <li key={item.categoryId ?? "uncategorized"} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: getChartColor(index) }}
              />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {item.categoryName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
