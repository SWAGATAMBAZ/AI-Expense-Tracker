import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentMethodChart } from "./PaymentMethodChart";

describe("PaymentMethodChart", () => {
  it("renders a legend row per payment method with its total", () => {
    render(
      <PaymentMethodChart
        items={[
          { method: "UPI", amount: 500_00, percentage: 50 },
          { method: "Unspecified", amount: 500_00, percentage: 50 },
        ]}
        currency="INR"
      />
    );

    expect(screen.getByText("UPI")).toBeInTheDocument();
    expect(screen.getByText("Unspecified")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("shows an empty state when there is no data", () => {
    render(<PaymentMethodChart items={[]} currency="INR" />);

    expect(screen.getByText(/no expenses recorded for this period yet/i)).toBeInTheDocument();
  });
});
