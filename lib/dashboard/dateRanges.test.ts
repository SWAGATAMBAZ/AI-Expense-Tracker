import { describe, expect, it } from "vitest";
import { resolveDateRange } from "./dateRanges";

describe("resolveDateRange", () => {
  const today = "2026-03-15"; // a Sunday

  it("today: start and end are both today", () => {
    expect(resolveDateRange("today", {}, today)).toEqual({
      start: "2026-03-15",
      end: "2026-03-15",
      label: "Today",
    });
  });

  it("week: Monday of the current week through today", () => {
    const result = resolveDateRange("week", {}, today);
    expect(result.start).toBe("2026-03-09"); // Monday
    expect(result.end).toBe("2026-03-15");
  });

  it("week: when today is a Monday, the range is a single day", () => {
    const result = resolveDateRange("week", {}, "2026-03-09");
    expect(result.start).toBe("2026-03-09");
    expect(result.end).toBe("2026-03-09");
  });

  it("month: full calendar month bounds", () => {
    expect(resolveDateRange("month", {}, today)).toEqual({
      start: "2026-03-01",
      end: "2026-03-31",
      label: "This Month",
    });
  });

  it("month: handles a 28-day February correctly", () => {
    const result = resolveDateRange("month", {}, "2026-02-10");
    expect(result.end).toBe("2026-02-28");
  });

  it("last_month: full prior calendar month, including a year boundary", () => {
    expect(resolveDateRange("last_month", {}, today)).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
      label: "Last Month",
    });
    const janResult = resolveDateRange("last_month", {}, "2026-01-15");
    expect(janResult).toEqual({ start: "2025-12-01", end: "2025-12-31", label: "Last Month" });
  });

  it("previous_months: defaults to the month before last", () => {
    const result = resolveDateRange("previous_months", {}, today);
    expect(result.start).toBe("2026-01-01");
    expect(result.end).toBe("2026-01-31");
  });

  it("previous_months: resolves an explicit yyyy-mm param", () => {
    const result = resolveDateRange("previous_months", { month: "2025-06" }, today);
    expect(result).toEqual({ start: "2025-06-01", end: "2025-06-30", label: "June 2025" });
  });

  it("custom: uses the provided from/to bounds", () => {
    expect(resolveDateRange("custom", { from: "2026-03-05", to: "2026-03-10" }, today)).toEqual({
      start: "2026-03-05",
      end: "2026-03-10",
      label: "Custom Range",
    });
  });

  it("custom: swaps from/to if given in reverse order", () => {
    const result = resolveDateRange("custom", { from: "2026-03-10", to: "2026-03-05" }, today);
    expect(result.start).toBe("2026-03-05");
    expect(result.end).toBe("2026-03-10");
  });

  it("custom range spanning exactly one calendar month matches the month preset's bounds", () => {
    const custom = resolveDateRange("custom", { from: "2026-03-01", to: "2026-03-31" }, today);
    const preset = resolveDateRange("month", {}, today);
    expect(custom.start).toBe(preset.start);
    expect(custom.end).toBe(preset.end);
  });

  it("falls back to the month preset for an unrecognized filter", () => {
    // @ts-expect-error intentionally passing an invalid filter to test the fallback
    const result = resolveDateRange("bogus", {}, today);
    expect(result.label).toBe("This Month");
  });
});
