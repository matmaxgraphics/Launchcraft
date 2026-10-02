import Anthropic from "@anthropic-ai/sdk";
import { MAX_CONTEXT_BYTES, MAX_QUESTION_CHARS, mapError, streamAnswer, type StreamClient } from "@/copilot/ai";

export const runtime = "nodejs";

/** Advisory only: a logged-in `ant` profile also works without these env vars, so "false" isn't definitive. */
export async function GET() {
  return Response.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) });
}

// The API key is real money, so cap questions per connection. In-memory: fine for one server, not for a fleet.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

const fail = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (limited(ip)) return fail("You've asked a lot of questions. Try again in a while.", 429);

  const raw = await req.text();
  if (raw.length > MAX_CONTEXT_BYTES + 2048) return fail("That request is too large.", 413);
  let body: { question?: unknown; context?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("Couldn't read the request.", 400);
  }
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return fail("Ask a question first.", 400);
  if (question.length > MAX_QUESTION_CHARS) return fail(`Keep questions under ${MAX_QUESTION_CHARS} characters.`, 400);
  if (JSON.stringify(body.context ?? {}).length > MAX_CONTEXT_BYTES) return fail("That request is too large.", 413);

  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch (e) {
    const m = mapError(e);
    return fail(m.message, m.status);
  }

  // Pull the first chunk before replying so auth/validation errors come back as a proper HTTP error, not a broken stream.
  const gen = streamAnswer(client as unknown as StreamClient, question, body.context);
  let first: IteratorResult<string>;
  try {
    first = await gen.next();
  } catch (e) {
    const m = mapError(e);
    return fail(m.message, m.status);
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(enc.encode(first.value));
        for await (const chunk of gen) controller.enqueue(enc.encode(chunk));
        controller.close();
      } catch (e) {
        controller.error(new Error(mapError(e).message));
      }
    },
    cancel() {
      void gen.return(undefined);
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
