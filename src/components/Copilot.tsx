"use client";

import { useState } from "react";
import { AskBox } from "./AskBox";
import { QA_LIST, type Ctx, type Insight } from "@/copilot/insights";

interface Props {
  insights: Insight[];
  ctx: Ctx;
  onShow: (range: [number, number] | null) => void;
  showingId: string | null;
  setShowingId: (id: string | null) => void;
  /** Which Q&A chips are relevant to this step. */
  qaIds: string[];
  /** Builds the grounded context for AI questions; omit to hide the ask box. */
  getAskContext?: () => unknown;
}

const ASK_SUGGESTIONS = ["Explain my launch in plain language", "What could surprise a buyer here?", "What does the curve shape mean for early buyers?"];

export function Copilot({ insights, ctx, onShow, showingId, setShowingId, qaIds, getAskContext }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const qa = QA_LIST.filter((q) => qaIds.includes(q.id));
  const active = QA_LIST.find((q) => q.id === open);

  return (
    <aside className="copilot" aria-label="Launch Copilot">
      <div className="copilot-head">
        <span className="copilot-dot" />
        <b>Launch Copilot</b>
        <span className="faint" style={{ marginLeft: "auto", fontSize: 12 }}>
          reads your config
        </span>
      </div>

      {insights.map((i) => (
        <div className="insight fade-up" key={i.id}>
          <p>{i.text}</p>
          {i.why && <div className="why">{i.why}</div>}
          {i.highlight && (
            <div className="show">
              {showingId === i.id ? (
                <button
                  className="link-btn"
                  onClick={() => {
                    onShow(null);
                    setShowingId(null);
                  }}
                >
                  Hide
                </button>
              ) : (
                <button
                  className="link-btn"
                  onClick={() => {
                    onShow(i.highlight!);
                    setShowingId(i.id);
                  }}
                >
                  Show me →
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {qa.length > 0 && (
        <div className="insight">
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Ask
          </div>
          <div className="qa">
            {qa.map((q) => (
              <button key={q.id} className={`chip ${open === q.id ? "on" : ""}`} onClick={() => setOpen(open === q.id ? null : q.id)}>
                {q.q}
              </button>
            ))}
          </div>
          {active && <div className="qa-answer fade-up" dangerouslySetInnerHTML={{ __html: active.a(ctx) }} />}
        </div>
      )}

      {getAskContext && <AskBox getContext={getAskContext} suggestions={ASK_SUGGESTIONS} />}

      <div className="copilot-foot">Readouts describe your configuration. They aren&apos;t financial advice or predictions.</div>
    </aside>
  );
}
