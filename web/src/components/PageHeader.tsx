import type { ReactNode } from "react";

export function PageHeader({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="text-accent text-xs font-mono uppercase tracking-wider mb-2">
        Step {step.toString().padStart(2, "0")}
      </div>
      <h2 className="text-3xl font-semibold tracking-tighter mb-2">
        {title}
      </h2>
      <p className="text-muted text-sm leading-relaxed max-w-2xl">
        {description}
      </p>
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {hint && <p className="text-muted text-xs">{hint}</p>}
    </div>
  );
}
