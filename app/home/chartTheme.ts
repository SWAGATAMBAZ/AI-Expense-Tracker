// Qualitative palette for charts, led by the app's own indigo/emerald brand
// colors (app/globals.css's --color-primary/--color-accent) and extended
// with a handful of visually distinct colors for categories beyond those two.
export const CHART_COLORS = [
  "#4338ca", // indigo (--color-primary)
  "#059669", // emerald (--color-accent)
  "#d97706", // amber
  "#db2777", // pink
  "#0891b2", // cyan
  "#7c3aed", // violet
  "#65a30d", // lime
  "#dc2626", // red (--color-danger)
] as const;

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

export const CHART_AXIS_TICK = { fontSize: 12, fill: "var(--color-text-secondary)" };
