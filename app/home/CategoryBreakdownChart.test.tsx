import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";

describe("CategoryBreakdownChart", () => {
  it("renders a list row per category with amount and percentage", () => {
    render(
      <CategoryBreakdownChart
        items={[
          { categoryId: 1, categoryName: "Food & Dining", amount: 700_00, percentage: 70 },
          { categoryId: 2, categoryName: "Groceries", amount: 300_00, percentage: 30 },
        ]}
        currency="INR"
      />
    );

    // The category name appears both as a chart axis label and in the list below.
    expect(screen.getAllByText("Food & Dining").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Groceries").length).toBeGreaterThan(0);
    expect(screen.getByText(/70%/)).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });

  it("shows an empty state with a link to add an expense when there is no data", () => {
    render(<CategoryBreakdownChart items={[]} currency="INR" />);

    expect(screen.getByText(/no expenses recorded for this period yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add an expense/i })).toHaveAttribute(
      "href",
      "/transactions/new"
    );
  });
});
