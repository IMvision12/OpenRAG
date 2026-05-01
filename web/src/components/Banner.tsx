import type { ReactNode } from "react";
import { Info, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

type Tone = "info" | "success" | "warning" | "error";

const TONES: Record<
  Tone,
  { icon: typeof Info; color: string; bg: string; border: string }
> = {
  info: {
    icon: Info,
    color: "text-accent",
    bg: "bg-accent-soft",
    border: "border-accent-border",
  },
  success: {
    icon: CheckCircle2,
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
  error: {
    icon: AlertCircle,
    color: "text-rose-300",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
  },
};

export function Banner({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${t.bg} ${t.border} text-sm`}
    >
      <Icon size={16} className={`${t.color} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}
