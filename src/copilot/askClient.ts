/** Browser-side streaming call to /api/copilot. Calls onText with the answer-so-far as it arrives. */

export async function askCopilot(a: { question: string; context: unknown; onText: (answerSoFar: string) => void; signal?: AbortSignal }): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/copilot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: a.question, context: a.context }),
      signal: a.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("Couldn't reach the Copilot service. Check your connection and try again.");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "The Copilot couldn't answer right now.");
  }
  if (!res.body) throw new Error("The Copilot returned an empty response.");

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      a.onText(text);
    }
    text += dec.decode();
    a.onText(text);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    // the server aborted the stream mid-answer: keep what we have and say so
    throw new Error(text ? "The answer was interrupted." : "The Copilot couldn't answer right now.");
  }
}
