import { ArrowRight, Database, Network, Cpu, Sparkles, FileText, MessageSquare } from "lucide-react";

const FEATURES = [
  {
    icon: Database,
    title: "Hybrid Retrieval",
    desc: "Chroma vector search + Neo4j knowledge graph, deduplicated and reranked together for the best of both worlds.",
  },
  {
    icon: Network,
    title: "Knowledge Graph",
    desc: "An LLM extracts entities and typed relationships from every chunk so Neo4j becomes a real graph, not flat storage.",
  },
  {
    icon: Cpu,
    title: "Open-Source LLMs",
    desc: "Run answers locally through Ollama or HuggingFace Transformers. Your documents never leave your machine.",
  },
  {
    icon: Sparkles,
    title: "Calibrated Mode Gating",
    desc: "A cross-encoder reranker decides between strict RAG mode (with citations) and free-form chat — no fabricated sources.",
  },
  {
    icon: FileText,
    title: "Multi-format Ingest",
    desc: "PDF and DOCX with fixed-size or embedding-based semantic chunking. Source attribution is preserved end-to-end.",
  },
  {
    icon: MessageSquare,
    title: "Built-in Chat",
    desc: "Conversational UI with retrieved-chunk inspection, mode badges, top-score chips, and live entity diagnostics.",
  },
];

const STATS = [
  { value: "2", label: "Storage backends" },
  { value: "10+", label: "Local LLM presets" },
  { value: "5", label: "Evaluation metrics" },
];

export function HomePage({ onStart }: { onStart: () => void }) {
  return (
    <div className="fade-in">
      {/* Hero */}
      <section className="text-center pt-12 pb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-soft border border-accent-border text-xs font-medium text-accent mb-6">
          <Sparkles size={12} />
          CPSC-597 · California State University, Fullerton
        </div>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tighter mb-5 leading-[1.05]">
          Retrieval-Augmented Generation
          <br />
          <span
            style={{
              background: "linear-gradient(90deg, #8c98ff, #c2a8ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            with Open-Source LLMs.
          </span>
        </h1>
        <p className="text-muted text-lg max-w-2xl mx-auto leading-relaxed mb-9">
          Hybrid retrieval over Chroma + Neo4j, with a connected
          knowledge graph extracted by an LLM and answers generated
          locally through Ollama or HuggingFace.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onStart}
            className="btn-primary inline-flex items-center gap-2 text-base px-7 py-3.5"
          >
            Let's get started
            <ArrowRight size={18} />
          </button>
          <a
            href="https://github.com/IMvision12"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost inline-flex items-center gap-2 text-sm"
          >
            View source
          </a>
        </div>
      </section>

      {/* Stats */}
      <section className="flex justify-center gap-12 sm:gap-20 py-8 border-y border-border mb-16">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-3xl font-semibold tracking-tight bg-clip-text text-transparent" style={{
              backgroundImage: "linear-gradient(180deg, #fff, #b9bdd0)",
            }}>
              {s.value}
            </div>
            <div className="text-muted text-xs mt-1 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Features grid */}
      <section className="mb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-semibold mb-2">
            Everything you need for production RAG
          </h2>
          <p className="text-muted text-sm">
            A four-step wizard walks you through configuration, model
            selection, ingestion, and chat.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card card-hover p-5"
            >
              <div className="w-10 h-10 rounded-lg bg-accent-soft border border-accent-border flex items-center justify-center mb-4">
                <f.icon size={18} className="text-accent" />
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-semibold mb-2">How it works</h2>
          <p className="text-muted text-sm">
            Four steps from cold start to a chat session over your
            documents.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { n: "01", title: "Configuration", desc: "Pick the backend, chunking strategy, and top-k." },
            { n: "02", title: "Models", desc: "Select embedding + answer LLM, plus an optional graph extractor." },
            { n: "03", title: "Documents", desc: "Upload PDFs or DOCXs and ingest into the configured stores." },
            { n: "04", title: "Chat", desc: "Ask questions; answers cite chunks in RAG mode, otherwise chat mode." },
          ].map((s) => (
            <div key={s.n} className="card p-5">
              <div className="text-accent font-mono text-sm mb-3">{s.n}</div>
              <h3 className="font-semibold mb-1.5">{s.title}</h3>
              <p className="text-muted text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="text-center pb-12">
        <button
          type="button"
          onClick={onStart}
          className="btn-primary inline-flex items-center gap-2 text-base px-7 py-3.5"
        >
          Let's get started
          <ArrowRight size={18} />
        </button>
        <div className="text-muted text-xs mt-4">
          No installation prompt — your config lives in the browser
          session.
        </div>
      </section>
    </div>
  );
}
