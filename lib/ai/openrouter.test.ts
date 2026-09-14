import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenRouter } from "./openrouter";

const messages = [{ role: "user" as const, content: "spent 500 on lunch" }];
const options = { apiKey: "test-key", primaryModel: "primary/model:free", fallbackModel: "fallback/model:free" };

function jsonResponse(content: string, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callOpenRouter", () => {
  it("returns an error without calling fetch when unconfigured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await callOpenRouter(messages, { apiKey: "", primaryModel: "" });

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the primary model's content on success, calling fetch once", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('{"action":"unknown"}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callOpenRouter(messages, options);

    expect(result).toEqual({ ok: true, content: '{"action":"unknown"}', model: "primary/model:free" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the secondary model when the primary responds with an error status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse("", false, 429))
      .mockResolvedValueOnce(jsonResponse('{"action":"clarify","question":"How much?"}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callOpenRouter(messages, options);

    expect(result).toEqual({
      ok: true,
      content: '{"action":"clarify","question":"How much?"}',
      model: "fallback/model:free",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a failure when both the primary and fallback fail", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse("", false, 500));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callOpenRouter(messages, options);

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not call the fallback when none is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse("", false, 500));
    vi.stubGlobal("fetch", fetchMock);

    const result = await callOpenRouter(messages, { ...options, fallbackModel: undefined });

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a network/timeout error as a failure instead of throwing", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", fetchMock);

    const result = await callOpenRouter(messages, options);

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
