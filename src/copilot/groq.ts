/**
 * SERVER-ONLY alternative backend for the Copilot: Groq's OpenAI-compatible chat API (has a free tier).
 * It reuses the exact same grounded prompt as the Claude path (SYSTEM_PROMPT + buildUserMessage), so the safety
 * rules (use only the supplied facts, no advice, untrusted data block) are identical whichever model answers.
 * Uses plain fetch, so no extra dependency. `fetchImpl` is injectable for tests.
 */
import { SYSTEM_PROMPT, buildUserMessage, type MappedError } from "./ai";

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
/** Override with GROQ_MODEL (Groq retires models over time; see console.groq.com/docs/models). */
export const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

export class GroqError extends Error {
  constructor(
    public status: number,
    message = "groq error",
  ) {
    super(message);
  }
}

/** Which backend answers: Anthropic wins if it is configured; otherwise Groq if its key is set. */
export function activeProvider(env: Record<string, string | undefined> = process.env): "anthropic" | "groq" {
  const anthropic = Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
  return !anthropic && env.GROQ_API_KEY ? "groq" : "anthropic";
}

export interface GroqOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

/** Streams the answer as text chunks. Throws GroqError (status only: never includes the key or response body) on failure. */
export async function* streamGroq(question: string, context: unknown, opts: GroqOptions): AsyncGenerator<string> {
  const f = opts.fetchImpl ?? fetch;
  const model = opts.model ?? GROQ_MODEL;
  let res: Response;
  try {
    res = await f(GROQ_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.2,
        // gpt-oss models "think" first and that counts against the cap, so give room and keep the thinking short.
        // (The param is only sent to models that accept it: others would reject it with a 400.)
        max_tokens: 2000,
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(question, context) },
        ],
      }),
    });
  } catch {
    throw new GroqError(0, "network");
  }
  if (!res.ok || !res.body) throw new GroqError(res.status || 502);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let finish: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let json: { choices?: { delta?: { content?: string }; finish_reason?: string | null }[] };
      try {
        json = JSON.parse(data);
      } catch {
        continue; // ignore a malformed keep-alive/partial frame
      }
      const choice = json.choices?.[0];
      if (choice?.delta?.content) yield choice.delta.content;
      if (choice?.finish_reason) finish = choice.finish_reason;
    }
  }
  if (finish === "length") yield "\n\n(The answer was cut off.)";
}

export function mapGroqError(e: unknown): MappedError {
  const status = e instanceof GroqError ? e.status : -1;
  if (status === 401 || status === 403) return { status: 401, message: "The Groq API key was rejected. Check GROQ_API_KEY, then redeploy or restart the dev server." };
  if (status === 404) return { status: 502, message: "The configured Groq model wasn't found. Set GROQ_MODEL to a current model." };
  if (status === 429) return { status: 429, message: "The AI is busy right now (free-tier limit). Try again in a moment." };
  if (status === 0) return { status: 502, message: "Couldn't reach Groq. Check your connection and try again." };
  if (status === 400) return { status: 400, message: "The AI service rejected this request." };
  if (status >= 500) return { status: 502, message: "The AI service had a problem. Try again shortly." };
  return { status: 500, message: "Something went wrong generating the answer." };
}
