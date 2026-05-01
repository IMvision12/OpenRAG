import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  ArrowLeft,
  ArrowRight,
  Database,
  Cpu,
  Network,
  HardDrive,
  ChevronDown,
} from "lucide-react";
import { api, humanSize } from "../lib/api";
import { Banner } from "../components/Banner";
import { PageHeader, SectionHeader } from "../components/PageHeader";
import type {
  GraphLLMProvider,
  LLMProvider,
  PipelineConfig,
  Presets,
} from "../lib/types";

export function ModelsPage({
  config,
  presets,
  onChange,
  onBack,
  onNext,
}: {
  config: PipelineConfig;
  presets: Presets;
  onChange: (patch: Partial<PipelineConfig>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const showGraphLLM =
    config.backend === "neo4j" || config.backend === "both";

  const ready =
    !!config.embedding_model &&
    !!config.llm_provider &&
    (config.llm_provider === "ollama"
      ? !!config.ollama_model
      : !!config.hf_model) &&
    (showGraphLLM && config.graph_llm_provider !== "none"
      ? !!config.graph_llm_model
      : true);

  return (
    <section>
      <PageHeader
        step={2}
        title="Models"
        description="Pick the embedding model, the LLM that generates answers, and (for graph backends) the LLM that extracts entities at ingest time."
      />

      <div className="card p-6 mb-4">
        <SectionHeader
          title="Embedding model"
          hint="Used to vectorize chunks and queries. Smaller = faster, larger = better recall."
        />
        <div className="flex items-center gap-3 mb-3">
          <Database size={16} className="text-accent flex-shrink-0" />
          <PresetCombo
            presets={presets.embedding}
            value={config.embedding_model}
            onChange={(v) => onChange({ embedding_model: v })}
          />
        </div>
      </div>

      <div className="card p-6 mb-4">
        <SectionHeader
          title="Answer LLM"
          hint="Generates the actual chat answer from retrieved chunks. Runs locally."
        />
        <div className="grid sm:grid-cols-2 gap-3 mb-5">
          {(
            [
              { id: "huggingface" as LLMProvider, title: "HuggingFace", hint: "Local Transformers pipeline" },
              { id: "ollama" as LLMProvider, title: "Ollama", hint: "Local or cloud-hosted via Ollama server" },
            ]
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ llm_provider: p.id })}
              className={[
                "text-left p-4 rounded-xl border transition-all duration-200 flex items-center gap-3",
                config.llm_provider === p.id
                  ? "bg-accent-soft border-accent-border"
                  : "bg-surface border-border hover:bg-surface-2",
              ].join(" ")}
            >
              <Cpu
                size={16}
                className={
                  config.llm_provider === p.id
                    ? "text-accent"
                    : "text-muted"
                }
              />
              <div>
                <div className="font-semibold text-sm">{p.title}</div>
                <div className="text-muted text-xs">{p.hint}</div>
              </div>
            </button>
          ))}
        </div>

        {config.llm_provider === "ollama" && (
          <PresetCombo
            label="Ollama model"
            presets={presets.ollama_llm}
            value={config.ollama_model}
            onChange={(v) => onChange({ ollama_model: v })}
            placeholder="Pick an Ollama model"
            hint={
              config.ollama_model
                ? config.ollama_model.includes(":cloud")
                  ? "Cloud model: requires a signed-in Ollama account with credits."
                  : `Local model: ensure you have run \`ollama pull ${config.ollama_model}\`.`
                : undefined
            }
          />
        )}
        {config.llm_provider === "huggingface" && (
          <>
            <PresetCombo
              label="HuggingFace model"
              presets={presets.hf_llm}
              value={config.hf_model}
              onChange={(v) => onChange({ hf_model: v })}
              placeholder="Pick a HuggingFace model"
            />
            <label className="block mt-4">
              <div className="text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">
                HuggingFace access token (optional)
              </div>
              <input
                type="password"
                value={config.hf_token}
                onChange={(e) => onChange({ hf_token: e.target.value })}
                placeholder="hf_..."
                className="input w-full font-mono"
              />
              <div className="text-muted text-xs mt-1.5">
                Required only for gated models (Llama, Gemma, Mistral). Stored
                only in this browser session.
              </div>
            </label>
          </>
        )}
      </div>

      {showGraphLLM && (
        <div className="card p-6 mb-4">
          <SectionHeader
            title="Graph-extraction LLM"
            hint="Builds the knowledge graph by extracting entities and relationships at ingest time. Runs locally."
          />
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            {(
              [
                { id: "none" as GraphLLMProvider, title: "None (skip)", hint: "Flat :Chunk nodes only" },
                { id: "ollama" as GraphLLMProvider, title: "Ollama", hint: "Local or cloud server" },
                { id: "huggingface" as GraphLLMProvider, title: "HuggingFace", hint: "Local Transformers" },
              ]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  onChange({
                    graph_llm_provider: p.id,
                    graph_llm_model:
                      p.id === "none" ? "" : config.graph_llm_model,
                  })
                }
                className={[
                  "text-left p-4 rounded-xl border transition-all duration-200 flex items-center gap-3",
                  config.graph_llm_provider === p.id
                    ? "bg-accent-soft border-accent-border"
                    : "bg-surface border-border hover:bg-surface-2",
                ].join(" ")}
              >
                <Network
                  size={16}
                  className={
                    config.graph_llm_provider === p.id
                      ? "text-accent"
                      : "text-muted"
                  }
                />
                <div>
                  <div className="font-semibold text-sm">{p.title}</div>
                  <div className="text-muted text-xs">{p.hint}</div>
                </div>
              </button>
            ))}
          </div>

          {config.graph_llm_provider !== "none" && (
            <PresetCombo
              label={`${config.graph_llm_provider} model`}
              presets={presets.graph_llm[config.graph_llm_provider] ?? []}
              value={config.graph_llm_model}
              onChange={(v) => onChange({ graph_llm_model: v })}
              placeholder="Pick or type a model name"
              hint={
                config.graph_llm_provider === "ollama"
                  ? "Smaller models are usually a better fit here — extraction runs once per chunk."
                  : "Downloaded automatically on first use. Reuses your HuggingFace token if set."
              }
            />
          )}
        </div>
      )}

      <CacheManager />

      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={onNext}
          className="btn-primary inline-flex items-center gap-2"
        >
          Continue to Documents
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

function PresetCombo({
  label,
  presets,
  value,
  onChange,
  placeholder = "Choose…",
  hint,
}: {
  label?: string;
  presets: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [custom, setCustom] = useState(
    value && !presets.includes(value) ? value : "",
  );
  const usingPreset = !custom && presets.includes(value);

  return (
    <label className="block">
      {label && (
        <div className="text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">
          {label}
        </div>
      )}
      <div className="grid sm:grid-cols-[1fr_auto_1.6fr] gap-2 items-center">
        <select
          value={usingPreset ? value : ""}
          onChange={(e) => {
            setCustom("");
            onChange(e.target.value);
          }}
          className="input"
        >
          <option value="">{placeholder}</option>
          {presets.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="text-muted text-xs text-center">or custom</span>
        <input
          type="text"
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Type a model ID"
          className="input font-mono"
        />
      </div>
      {(hint || value) && (
        <div className="text-muted text-xs mt-1.5">
          {hint ?? (value ? `Selected: ${value}` : "")}
        </div>
      )}
    </label>
  );
}

function CacheManager() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const cache = useQuery({
    queryKey: ["hfCache"],
    queryFn: api.listHfCache,
    enabled: open,
  });
  const deleteOne = useMutation({
    mutationFn: (repoId: string) => api.deleteHfRepo(repoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hfCache"] }),
  });
  const deleteAll = useMutation({
    mutationFn: () => api.deleteAllHfCache(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hfCache"] }),
  });

  return (
    <div className="card p-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium hover:text-accent transition-colors w-full text-left"
      >
        <HardDrive size={16} className="text-muted" />
        HuggingFace cache management
        <ChevronDown
          size={14}
          className={`text-muted ml-auto transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="mt-5 space-y-2">
          {cache.isLoading && (
            <div className="text-muted text-sm">Scanning cache…</div>
          )}
          {cache.data && cache.data.repos.length === 0 && (
            <div className="text-muted text-sm">
              No HuggingFace models cached yet.
            </div>
          )}
          {cache.data && cache.data.repos.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span>
                  <b>{cache.data.repos.length}</b> model(s) ·{" "}
                  <b>{humanSize(cache.data.total_size)}</b> total
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Delete every cached HuggingFace model?")) {
                      deleteAll.mutate();
                    }
                  }}
                  disabled={deleteAll.isPending}
                  className="text-rose-400 hover:text-rose-300 text-sm disabled:opacity-50 font-medium"
                >
                  Delete all
                </button>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {cache.data.repos.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between px-3 py-2 bg-surface border border-border rounded-lg text-sm"
                  >
                    <div className="font-mono text-xs flex-1 truncate">
                      {r.id}{" "}
                      <span className="text-muted">
                        ({r.type}, {humanSize(r.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteOne.mutate(r.id)}
                      disabled={deleteOne.isPending}
                      className="text-muted hover:text-rose-400 disabled:opacity-50 ml-2"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {(deleteAll.isError || deleteOne.isError) && (
            <Banner tone="error">
              {(deleteAll.error || deleteOne.error)?.message}
            </Banner>
          )}
        </div>
      )}
    </div>
  );
}
