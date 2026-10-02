"use client";

import { useEffect, useRef, useState } from "react";
import { askCopilot } from "@/copilot/askClient";

interface Props {
  /** Evaluated at submit time so the answer reflects the current config / live state. */
  getContext: () => unknown;
  suggestions?: string[];
}

type Status = "idle" | "asking" | "done" | "error";

/** Free-form questions to the AI Copilot. The rule-based readouts above it keep working with no key. */
export function AskBox({ getContext, suggestions = [] }: Props) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || status === "asking") return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setQ(text);
    setAnswer("");
    setError(null);
    setStatus("asking");
    try {
      await askCopilot({ question: text, context: getContext(), onText: setAnswer, signal: ctl.signal });
      setStatus("done");
    } catch (e) {
      if ((e as Error).name === "AbortError") return setStatus("idle");
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <div className="ask">
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Ask the Copilot <span className="ai-badge">AI</span>
      </div>
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <input
          className="input"
          value={q}
          maxLength={500}
          placeholder="Ask about this launch…"
          aria-label="Ask the Copilot a question"
          onChange={(e) => setQ(e.target.value)}
        />
        {status === "asking" ? (
          <button className="btn sm" type="button" onClick={() => abort.current?.abort()}>
            Stop
          </button>
        ) : (
          <button className="btn sm accent" type="submit" disabled={!q.trim()}>
            Ask
          </button>
        )}
      </form>

      {suggestions.length > 0 && status === "idle" && !answer && (
        <div className="qa" style={{ marginTop: 8 }}>
          {suggestions.map((s) => (
            <button key={s} className="chip" onClick={() => void ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {(answer || status === "asking") && (
        <div className="qa-answer ai-answer" aria-live="polite">
          {answer || <span className="faint">Thinking…</span>}
          {status === "asking" && answer && <span className="caret" />}
        </div>
      )}
      {error && (
        <p className="field-msg error" style={{ marginTop: 8 }} role="alert">
          {error}
        </p>
      )}
      {status === "done" && <p className="faint" style={{ fontSize: 11.5, margin: "8px 0 0" }}>AI-written from this launch&apos;s data. It can be wrong; check the numbers above. Not financial advice.</p>}
    </div>
  );
}
