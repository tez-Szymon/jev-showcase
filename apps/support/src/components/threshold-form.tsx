"use client";
import { useActionState, useState } from "react";
import { updateSettings } from "@/app/actions/settings";
import { automaticLabels, labelNames } from "@/lib/catalog";
import type { Settings } from "@/lib/domain";
function Threshold({
  name,
  label,
  initial,
  onValue,
}: {
  name: string;
  label: string;
  initial: number;
  onValue?: (n: number) => void;
}) {
  const [value, setValue] = useState(String(initial));
  function change(v: string) {
    setValue(v);
    onValue?.(v === "" ? NaN : Number(v));
  }
  return (
    <div className="threshold">
      <label htmlFor={name}>{label}</label>
      <div className="range-row">
        <input
          aria-label={`${label} slider`}
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value || 0}
          onChange={(e) => change(e.target.value)}
        />
        <input
          id={name}
          aria-label={label}
          name={name}
          type="number"
          min="0"
          max="1"
          step="0.01"
          required
          value={value}
          onChange={(e) => change(e.target.value)}
        />
      </div>
    </div>
  );
}
export function ThresholdForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(updateSettings, {
    message: "",
  });
  const [confidence, setConfidence] = useState(settings.minConfidence);
  const [overrides, setOverrides] = useState(settings.categoryOverrides);
  return (
    <form action={action} className="stack">
      <input name="version" type="hidden" value={settings.version} />
      <Threshold
        name="minConfidence"
        label="Minimum confidence"
        initial={settings.minConfidence}
        onValue={setConfidence}
      />
      <Threshold
        name="minMargin"
        label="Minimum probability margin"
        initial={settings.minMargin}
      />
      <div>
        <h3>Category thresholds</h3>
        <p className="muted">
          Leave a field empty to use the global threshold.
        </p>
      </div>
      {automaticLabels.map((k) => (
        <div key={k}>
          <label htmlFor={`override-${k}`}>{labelNames[k]}</label>
          <div className="range-row">
            <input
              aria-label={`Slider: ${labelNames[k]}`}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={
                overrides[k] ?? (Number.isFinite(confidence) ? confidence : 0)
              }
              onChange={(e) =>
                setOverrides({ ...overrides, [k]: Number(e.target.value) })
              }
            />
          </div>
          <div className="override-row">
            <input
              id={`override-${k}`}
              aria-label={`Threshold: ${labelNames[k]}`}
              name={`override-${k}`}
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={overrides[k] ?? ""}
              placeholder="Global threshold"
              onChange={(e) =>
                setOverrides({
                  ...overrides,
                  [k]:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
            <span className="hint">
              Effective threshold:{" "}
              {Number.isFinite(overrides[k] ?? confidence)
                ? (overrides[k] ?? confidence).toFixed(2)
                : "—"}
            </span>
          </div>
        </div>
      ))}
      <div className="actions">
        <button
          className="primary"
          name="action"
          value="save"
          disabled={pending}
        >
          Save thresholds
        </button>
        <button name="action" value="reset" disabled={pending} formNoValidate>
          Restore defaults
        </button>
      </div>
      {state.message && (
        <p role="status" className={`notice ${state.ok ? "" : "error"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
