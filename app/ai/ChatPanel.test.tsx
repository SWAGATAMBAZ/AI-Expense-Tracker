import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatPanel } from "./ChatPanel";
import { interpretMessage } from "@/app/actions/ai";

vi.mock("@/app/actions/ai", () => ({
  interpretMessage: vi.fn(),
}));

const mockInterpretMessage = vi.mocked(interpretMessage);

function sendMessage(text: string) {
  fireEvent.change(screen.getByLabelText(/message/i), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
}

describe("ChatPanel", () => {
  it("shows a greeting on load", () => {
    render(<ChatPanel />);
    expect(screen.getByText(/tell me about an expense/i)).toBeInTheDocument();
  });

  it("sends a message, shows it immediately, and renders the confirmation", async () => {
    mockInterpretMessage.mockResolvedValue({
      kind: "confirmation",
      text: "Added ₹500 expense at Zomato.",
      href: "/transactions",
    });
    render(<ChatPanel />);

    sendMessage("spent 500 at zomato");

    expect(screen.getByText("spent 500 at zomato")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/added ₹500 expense at zomato/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /view/i })).toHaveAttribute("href", "/transactions");
    expect(mockInterpretMessage).toHaveBeenCalledWith("spent 500 at zomato", null);
  });

  it("carries the pending intent into the next message after a clarifying question", async () => {
    mockInterpretMessage.mockResolvedValueOnce({
      kind: "clarify",
      text: "How much did you spend?",
      pending: { intent: { action: "add_transaction", merchant: "Zomato" }, missingFields: ["amount"] },
    });
    mockInterpretMessage.mockResolvedValueOnce({
      kind: "confirmation",
      text: "Added ₹500 expense at Zomato.",
    });
    render(<ChatPanel />);

    sendMessage("spent something at zomato");
    await waitFor(() => {
      expect(screen.getByText(/how much did you spend/i)).toBeInTheDocument();
    });

    sendMessage("500");

    await waitFor(() => {
      expect(mockInterpretMessage).toHaveBeenLastCalledWith("500", {
        intent: { action: "add_transaction", merchant: "Zomato" },
        missingFields: ["amount"],
      });
    });
  });

  it("shows a fallback message if interpretMessage throws unexpectedly", async () => {
    mockInterpretMessage.mockRejectedValue(new Error("network down"));
    render(<ChatPanel />);

    sendMessage("spent 500 on lunch");

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});
