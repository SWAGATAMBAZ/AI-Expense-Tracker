import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom implements neither of these, but Recharts' ResponsiveContainer needs
// both to measure itself and render its children in tests.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => ({
    width: 375,
    height: 300,
    top: 0,
    left: 0,
    bottom: 300,
    right: 375,
    x: 0,
    y: 0,
    toJSON() {},
  }),
});
