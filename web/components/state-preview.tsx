"use client";

/**
 * The five states every screen must have (§A5). This strip is a review affordance -
 * it exists so each state can be looked at side by side, and it is stripped from a
 * production build.
 *
 * A screen with a state of its own - the live call is either running or idle - passes
 * its own list rather than inventing a second strip.
 */
export type ScreenState =
  | "default"
  | "empty"
  | "loading"
  | "error"
  | "offline"
  | "idle"
  | "running"
  | "stale"
  | "none"
  | "security"
  | "current"
  | "typed"
  | "creating"
  | "taken"
  | "done";

const DEFAULT_STATES: ScreenState[] = ["default", "empty", "loading", "error", "offline"];

export function StatePreview({
  state,
  onChange,
  states = DEFAULT_STATES,
  labels,
}: {
  state: ScreenState;
  onChange: (next: ScreenState) => void;
  states?: ScreenState[];
  labels?: Partial<Record<ScreenState, string>>;
}) {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      dir="ltr"
      className="border-od-border sticky top-0 z-40 flex justify-center border-b p-[10px]"
      style={{ background: "linear-gradient(var(--od-canvas), var(--od-scrim))" }}
    >
      <div className="border-od-border-2 bg-od-panel flex items-center gap-[6px] rounded-full border p-[5px]">
        <span className="text-od-faint ps-[10px] pe-1 text-[11px] tracking-[.09em] uppercase">
          State
        </span>
        {states.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`cursor-pointer rounded-full border px-[13px] py-[6px] text-[13px] ${
              // Only the bare state ids need capitalising; a supplied label is already written.
              labels?.[value] ? "" : "capitalize"
            } ${
              value === state
                ? "border-od-stroke bg-od-line-2 text-od-text"
                : "text-od-muted-4 border-transparent bg-transparent"
            }`}
          >
            {labels?.[value] ?? value}
          </button>
        ))}
      </div>
    </div>
  );
}
