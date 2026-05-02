import { Database, Network, ArrowRight } from "lucide-react";
import { PageHeader, SectionHeader } from "../components/PageHeader";
import type { Backend, Chunking, PipelineConfig } from "../lib/types";

const BACKENDS: {
  id: Backend;
  title: string;
  desc: string;
  icon: typeof Database;
}[] = [
  {
    id: "vector",
    title: "Vector",
    desc: "Chroma similarity search only. Fastest. No external services needed.",
    icon: Database,
  },
  {
    id: "neo4j",
    title: "Neo4j Graph",
    desc: "Pure knowledge-graph retrieval. Requires Neo4j, APOC, and a graph LLM.",
    icon: Network,
  },
];

export function ConfigurationPage({
  config,
  onChange,
  onNext,
}: {
  config: PipelineConfig;
  onChange: (patch: Partial<PipelineConfig>) => void;
  onNext: () => void;
}) {
  const canProceed = !!config.backend;

  return (
    <section>
      <PageHeader
        step={1}
        title="Configuration"
        description="Pick the retrieval backend and how documents should be chunked. These choices shape what's available in later steps."
      />

      <div className="card p-6 mb-6">
        <SectionHeader
          title="Retrieval backend"
          hint="Where retrieved chunks come from at query time."
        />
        <div className="grid sm:grid-cols-2 gap-3">
          {BACKENDS.map((b) => {
            const sel = config.backend === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onChange({ backend: b.id })}
                className={[
                  "text-left p-5 rounded-xl border transition-all duration-200",
                  sel
                    ? "bg-accent-soft border-accent-border shadow-sm"
                    : "bg-surface border-border hover:border-accent-border/60 hover:bg-surface-2",
                ].join(" ")}
              >
                <div className="flex items-center gap-2 mb-2">
                  <b.icon
                    size={16}
                    className={sel ? "text-accent" : "text-muted"}
                  />
                  <div className="font-semibold text-sm">{b.title}</div>
                </div>
                <div className="text-muted text-xs leading-relaxed">
                  {b.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chunking only matters once the user has chosen a backend —
          hide the whole card until then to keep the page focused. */}
      {config.backend && (
        <div className="card p-6 mb-6 fade-in">
          <SectionHeader
            title="Chunking strategy"
            hint="How documents are split before embedding."
          />
          <div className="flex gap-3 mb-6 flex-wrap">
            {(
              [
                { id: "fixed" as Chunking, label: "Fixed-size", hint: "Predictable, fast" },
                { id: "semantic" as Chunking, label: "Semantic", hint: "Embedding-aware splits" },
              ]
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange({ chunking: c.id })}
                className={[
                  "flex-1 min-w-[180px] text-left p-4 rounded-xl border transition-all duration-200",
                  config.chunking === c.id
                    ? "bg-accent-soft border-accent-border"
                    : "bg-surface border-border hover:bg-surface-2",
                ].join(" ")}
              >
                <div className="font-semibold text-sm mb-0.5">{c.label}</div>
                <div className="text-muted text-xs">{c.hint}</div>
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <NumField
              label="Top-K"
              value={config.top_k}
              min={1}
              max={20}
              onChange={(v) => onChange({ top_k: v })}
              hint="Chunks returned per query."
            />
            {config.chunking === "fixed" && (
              <>
                <NumField
                  label="Chunk size"
                  value={config.chunk_size}
                  min={200}
                  max={4000}
                  step={50}
                  onChange={(v) => onChange({ chunk_size: v })}
                  hint="Characters per chunk."
                />
                <NumField
                  label="Overlap"
                  value={config.chunk_overlap}
                  min={0}
                  max={1000}
                  step={20}
                  onChange={(v) => onChange({ chunk_overlap: v })}
                  hint="Overlap between adjacent chunks."
                />
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canProceed}
          onClick={onNext}
          className="btn-primary inline-flex items-center gap-2"
        >
          Continue to Models
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">
        {label}
      </div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input w-full"
      />
      {hint && <div className="text-muted text-xs mt-1.5">{hint}</div>}
    </label>
  );
}
