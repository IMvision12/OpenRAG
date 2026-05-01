type Tone = "default" | "success" | "muted" | "accent";

const TONES: Record<Tone, string> = {
  default: "bg-surface border-border text-text",
  success:
    "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  muted: "bg-surface border-border text-muted",
  accent: "bg-accent-soft border-accent-border text-accent",
};

export function Chip({
  k,
  v,
  tone = "default",
}: {
  k?: string;
  v: string;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-mono whitespace-nowrap ${TONES[tone]}`}
    >
      {k && <span className="text-muted mr-1.5 font-sans">{k}</span>}
      {v}
    </span>
  );
}
