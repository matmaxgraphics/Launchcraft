"use client";

import { createContext, useContext, useEffect, useId, useState } from "react";
import type { Issue } from "@/launch/validate";

export function pick(issues: Issue[], field: string) {
  return issues.find((i) => i.field === field);
}

/** True once the user has tried to continue past a step; from then on every issue is shown. */
export const AttemptedContext = createContext(false);

interface FieldProps {
  label: string;
  hint?: string;
  issue?: Issue;
  children: (p: { id: string; invalid: boolean }) => React.ReactNode;
}

/** Issues stay quiet on a pristine field; they appear after the field is touched or a continue attempt. */
export function Field({ label, hint, issue, children }: FieldProps) {
  const id = useId();
  const attempted = useContext(AttemptedContext);
  const [touched, setTouched] = useState(false);
  const shown = issue && (touched || attempted) ? issue : undefined;
  return (
    <div className="field" onBlur={() => setTouched(true)}>
      <label htmlFor={id}>{label}</label>
      {children({ id, invalid: shown?.severity === "error" })}
      {shown ? <span className={`field-msg ${shown.severity}`}>{shown.message}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

interface NumProps {
  id: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  invalid?: boolean;
  step?: number;
}

/** Text-backed number input so users can type "0." or clear the field without it snapping back. */
export function NumInput({ id, value, onChange, suffix, invalid }: NumProps) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="input-wrap">
      <input
        id={id}
        className={`input mono ${suffix ? "has-suffix" : ""} ${invalid ? "err" : ""}`}
        inputMode="decimal"
        value={text}
        aria-invalid={invalid}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9.]/g, "");
          setText(t);
          const n = Number(t);
          if (t !== "" && Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => setText(String(value))}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}
