import { Check } from "lucide-react";

interface StepperProps {
  current: number;
  steps: string[];
  onJump: (n: number) => void;
  canJump: (n: number) => boolean;
}

export function Stepper({ current, steps, onJump, canJump }: StepperProps) {
  return (
    <div className="card p-4 mb-8">
      <div className="flex items-center gap-1 select-none flex-wrap justify-center">
        {steps.map((label, i) => {
          const idx = i + 1;
          const done = idx < current;
          const active = idx === current;
          const enabled = canJump(idx);
          return (
            <div key={idx} className="flex items-center">
              <button
                type="button"
                disabled={!enabled}
                onClick={() => enabled && onJump(idx)}
                className={[
                  "flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all duration-200",
                  active
                    ? "bg-accent-soft text-text shadow-sm"
                    : done
                      ? "text-text"
                      : "text-muted",
                  enabled && !active
                    ? "hover:bg-surface-2 cursor-pointer"
                    : "",
                  !enabled ? "cursor-not-allowed opacity-50" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                    active
                      ? "text-bg"
                      : done
                        ? "bg-accent-soft text-accent border border-accent-border"
                        : "bg-surface-2 text-muted border border-border",
                  ].join(" ")}
                  style={
                    active
                      ? {
                          background:
                            "linear-gradient(135deg, #8c98ff, #c2a8ff)",
                          boxShadow:
                            "0 2px 8px rgba(124, 138, 255, 0.4)",
                        }
                      : undefined
                  }
                >
                  {done ? <Check size={14} strokeWidth={3} /> : idx}
                </span>
                <span className="text-sm font-medium whitespace-nowrap pr-1">
                  {label}
                </span>
              </button>
              {idx < steps.length && (
                <div
                  className={`w-6 h-px transition-colors ${
                    done ? "bg-accent-border" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
