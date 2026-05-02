import { RotateCcw } from "lucide-react";
import { Chip } from "./Chip";
import type { PipelineConfig } from "../lib/types";

export function Header({
  config,
  pipelineActive,
  onReset,
  onLogoClick,
  compact = false,
}: {
  config: PipelineConfig;
  pipelineActive: boolean;
  onReset: () => void;
  onLogoClick?: () => void;
  compact?: boolean;
}) {
  const llmChip = (() => {
    if (!config.llm_provider) return "—";
    const m =
      config.llm_provider === "ollama" ? config.ollama_model : config.hf_model;
    if (!m) return `${config.llm_provider}:—`;
    return `${config.llm_provider}:${m.split("/").pop()}`;
  })();

  return (
    <header className="flex items-start justify-between gap-4 mb-8">
      <button
        type="button"
        onClick={onLogoClick}
        className="flex items-center gap-3 text-left group"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-bg font-bold text-lg shadow-lg"
          style={{
            background: "linear-gradient(135deg, #8c98ff, #c2a8ff)",
            boxShadow: "0 4px 14px rgba(124, 138, 255, 0.35)",
          }}
        >
          ◆
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight leading-tight group-hover:text-accent transition-colors">
            RAG OpenLLMs
          </h1>
          <div className="text-muted text-xs">
            Vector or graph retrieval · open-source LLMs
          </div>
        </div>
      </button>

      <div className="flex items-center gap-3">
        {!compact && (
          <div className="hidden md:flex flex-wrap gap-1.5 justify-end max-w-md">
            <Chip k="backend" v={config.backend ?? "—"} />
            <Chip k="llm" v={llmChip} />
            <Chip
              k="status"
              v={pipelineActive ? "active" : "idle"}
              tone={pipelineActive ? "success" : "muted"}
            />
          </div>
        )}
        <button
          type="button"
          onClick={onReset}
          className="btn-ghost flex items-center gap-2 text-sm"
          title="Wipe all selections, uploaded files, chat history, and cached pipeline."
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>
    </header>
  );
}
