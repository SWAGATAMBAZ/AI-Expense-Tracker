import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateRangeFilter } from "./DateRangeFilter";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => pushMock.mockClear());

describe("DateRangeFilter", () => {
  it("opens the panel and applies a simple filter", () => {
    render(<DateRangeFilter active="month" label="This Month" />);

    fireEvent.click(screen.getByRole("button", { name: /this month/i }));
    fireEvent.click(screen.getByRole("button", { name: /^today$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^done$/i }));

    expect(pushMock).toHaveBeenCalledWith("/home?range=today");
  });

  it("blocks applying a custom range when only one date is filled", () => {
    render(<DateRangeFilter active="month" label="This Month" />);

    fireEvent.click(screen.getByRole("button", { name: /this month/i }));
    fireEvent.click(screen.getByRole("button", { name: /custom range/i }));
    fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: "2026-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: /^done$/i }));

    expect(screen.getByText(/select both a start and end date/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("applies a custom range once both dates are filled", () => {
    render(<DateRangeFilter active="month" label="This Month" />);

    fireEvent.click(screen.getByRole("button", { name: /this month/i }));
    fireEvent.click(screen.getByRole("button", { name: /custom range/i }));
    fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText(/^to$/i), { target: { value: "2026-01-10" } });
    fireEvent.click(screen.getByRole("button", { name: /^done$/i }));

    expect(pushMock).toHaveBeenCalledWith("/home?range=custom&from=2026-01-01&to=2026-01-10");
  });
});
