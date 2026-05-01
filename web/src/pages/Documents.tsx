import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Upload,
  X,
  FileText,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { api } from "../lib/api";
import { Banner } from "../components/Banner";
import { PageHeader, SectionHeader } from "../components/PageHeader";
import type { IngestSummary } from "../lib/types";

export function DocumentsPage({
  hasIngested,
  onIngestComplete,
  onBack,
  onNext,
}: {
  hasIngested: boolean;
  onIngestComplete: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [recreate, setRecreate] = useState(true);
  const [summary, setSummary] = useState<IngestSummary | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingest = useMutation({
    mutationFn: () => api.ingest(files, recreate),
    onSuccess: (data) => {
      setSummary(data);
      setFiles([]);
      // Only count the run as a real ingest if at least one file
      // produced chunks — otherwise downstream chat will be empty.
      if (data.total_chunks > 0) {
        onIngestComplete();
      }
    },
  });

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files ? Array.from(e.target.files) : []);
    e.target.value = "";
  }

  function addFiles(list: File[]) {
    const valid = list.filter((f) =>
      /\.(pdf|docx)$/i.test(f.name),
    );
    setFiles((prev) => [...prev, ...valid]);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  function removeAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <section>
      <PageHeader
        step={3}
        title="Documents"
        description="Upload PDF or DOCX files and ingest them into the configured backend(s). The pipeline initializes on the first ingest."
      />

      <div className="card p-6 mb-4">
        <SectionHeader
          title="Upload"
          hint="PDF and DOCX. You can pick multiple and add more before ingesting."
        />
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={[
            "block border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200",
            isDragging
              ? "border-accent-border bg-accent-soft"
              : "border-border hover:border-accent-border/60 hover:bg-surface/50",
          ].join(" ")}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx"
            onChange={onPick}
            className="hidden"
          />
          <div
            className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
            style={{
              background:
                "linear-gradient(135deg, rgba(124,138,255,0.18), rgba(194,168,255,0.10))",
              border: "1px solid rgba(124,138,255,0.25)",
            }}
          >
            <Upload size={22} className="text-accent" />
          </div>
          <div className="text-base font-medium mb-1">
            {isDragging
              ? "Drop your files here"
              : "Click to choose, or drag and drop"}
          </div>
          <div className="text-muted text-sm">
            PDF or DOCX, up to a few hundred MB total.
          </div>
        </label>
      </div>

      {files.length > 0 && (
        <div className="card p-6 mb-4">
          <SectionHeader title={`Queued (${files.length})`} />
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2.5 bg-surface border border-border rounded-lg text-sm"
              >
                <FileText size={14} className="text-accent flex-shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-muted text-xs font-mono">
                  {(f.size / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="text-muted hover:text-rose-400 transition-colors"
                  aria-label="Remove file"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recreate}
              onChange={(e) => setRecreate(e.target.checked)}
              className="accent-accent w-4 h-4"
            />
            <div>
              <div className="font-medium">Wipe existing stores</div>
              <div className="text-muted text-xs">
                Recreate Chroma + Neo4j before ingesting (recommended for fresh runs).
              </div>
            </div>
          </label>
          <button
            type="button"
            disabled={files.length === 0 || ingest.isPending}
            onClick={() => ingest.mutate()}
            className="btn-primary inline-flex items-center gap-2"
          >
            {ingest.isPending ? "Ingesting…" : "Ingest documents"}
          </button>
        </div>
      </div>

      {ingest.isError && (
        <Banner tone="error">
          Ingest failed: {(ingest.error as Error).message}
        </Banner>
      )}

      {summary && (
        <div className="card p-6 mb-4">
          <div className="flex items-start gap-3">
            <CheckCircle2
              size={20}
              className="text-emerald-400 flex-shrink-0 mt-0.5"
            />
            <div className="flex-1">
              <div className="font-semibold mb-1">Ingest complete</div>
              <div className="text-muted text-sm mb-3">
                <b className="text-text">{summary.files.length}</b> file(s),{" "}
                <b className="text-text">{summary.total_chunks}</b> chunks
                indexed.
              </div>
              <ul className="space-y-1">
                {summary.files.map((f) => (
                  <li
                    key={f}
                    className="text-sm font-mono text-muted flex items-center gap-2"
                  >
                    <FileText size={12} className="flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {summary.warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {summary.warnings.map((w, i) => (
                <Banner key={i} tone="warning">
                  {w}
                </Banner>
              ))}
            </div>
          )}
          {summary.errors.length > 0 && (
            <div className="mt-4 space-y-2">
              {summary.errors.map((e, i) => (
                <Banner key={i} tone="error">
                  {e}
                </Banner>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex items-center gap-3">
          {!hasIngested && (
            <span className="text-muted text-xs">
              Ingest at least one document to continue
            </span>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={!hasIngested}
            className="btn-primary inline-flex items-center gap-2"
          >
            Continue to Chat
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
