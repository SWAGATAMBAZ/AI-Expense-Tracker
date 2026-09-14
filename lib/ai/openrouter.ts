export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterSuccess {
  ok: true;
  content: string;
  model: string;
}

export interface OpenRouterFailure {
  ok: false;
  error: string;
}

export type OpenRouterResult = OpenRouterSuccess | OpenRouterFailure;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// A reasoning model given a larger token budget (see MAX_RESPONSE_TOKENS)
// takes longer to generate - verified against the real API that 15s was
// occasionally too tight and aborted a request that would have succeeded.
const REQUEST_TIMEOUT_MS = 25_000;
// Some free models (e.g. the configured primary) are "reasoning" models that
// spend hidden chain-of-thought tokens before the final answer, and reject
// requests to disable it ("reasoning is mandatory for this endpoint") - a
// tight budget here can be entirely consumed by reasoning, leaving no room
// for the actual JSON and silently returning empty content. Verified against
// the real API: both 400 and 1200 were sometimes too low for this prompt's
// length; 2000 leaves comfortable headroom for reasoning + a short answer.
const MAX_RESPONSE_TOKENS = 2000;

async function callModel(
  model: string,
  messages: OpenRouterMessage[],
  apiKey: string
): Promise<OpenRouterResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        max_tokens: MAX_RESPONSE_TOKENS,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[openrouter] ${model} responded with status ${response.status}`);
      return { ok: false, error: `Model responded with status ${response.status}` };
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      console.error(`[openrouter] ${model} returned no content`);
      return { ok: false, error: "Model returned no content." };
    }

    return { ok: true, content, model };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[openrouter] ${model} request failed:`, message);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export interface CallOpenRouterOptions {
  apiKey?: string;
  primaryModel?: string;
  fallbackModel?: string;
}

/**
 * Calls the primary OpenRouter model, retrying once against the fallback
 * model only if the primary errors/times out/returns unparsable content.
 * Never throws - callers always get an OpenRouterResult, so LLM downtime
 * degrades to a plain "unavailable" message instead of a crash (PRD §25.3).
 */
export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options?: CallOpenRouterOptions
): Promise<OpenRouterResult> {
  const apiKey = options?.apiKey ?? process.env.OPENROUTER_API_KEY;
  const primaryModel = options?.primaryModel ?? process.env.OPENROUTER_MODEL;
  const fallbackModel = options?.fallbackModel ?? process.env.OPENROUTER_FALLBACK_MODEL;

  if (!apiKey || !primaryModel) {
    return { ok: false, error: "OpenRouter is not configured (missing API key or model)." };
  }

  const primaryResult = await callModel(primaryModel, messages, apiKey);
  if (primaryResult.ok || !fallbackModel) return primaryResult;

  return callModel(fallbackModel, messages, apiKey);
}
