import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Send,
  ChevronDown,
  ArrowLeft,
  BookOpen,
  MessageCircle,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { Banner } from "../components/Banner";
import type { QueryResponse } from "../lib/types";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  meta?: QueryResponse;
}

const STARTERS = [
  "Summarize the document in one paragraph.",
  "What are the key skills mentioned?",
  "List the most recent work experience.",
  "What technologies are used?",
];

export function ChatPage({ onBack }: { onBack: () => void }) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (q: string) => api.query(q),
    onSuccess: (data) => {
      setHistory((h) => [
        ...h,
        { role: "assistant", text: data.answer, meta: data },
      ]);
    },
    onError: (err: Error) => {
      setHistory((h) => [
        ...h,
        { role: "assistant", text: `**Query failed:** ${err.message}` },
      ]);
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length, ask.isPending]);

  function send(text: string = input) {
    const q = text.trim();
    if (!q || ask.isPending) return;
    setInput("");
    setHistory((h) => [...h, { role: "user", text: q }]);
    ask.mutate(q);
  }

  return (
    <section
      className="flex flex-col"
      style={{ minHeight: "calc(100vh - 220px)" }}
    >
      <PageHeader
        step={4}
        title="Chat"
        description="Ask questions about your ingested documents. Answers cite chunk numbers in RAG mode and switch to chat mode when no chunk is relevant enough."
      />

      <div className="flex-1 space-y-4 mb-4">
        {history.length === 0 && !ask.isPending && (
          <div className="card p-8 text-center">
            <div
              className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(124,138,255,0.18), rgba(194,168,255,0.10))",
                border: "1px solid rgba(124,138,255,0.25)",
              }}
            >
              <Sparkles size={20} className="text-accent" />
            </div>
            <h3 className="font-semibold mb-1">Start the conversation</h3>
            <p className="text-muted text-sm mb-5 max-w-md mx-auto">
              The pipeline initializes on your first message — initial
              response may take a moment while the LLM loads.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="btn-ghost text-xs"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {history.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {ask.isPending && <ThinkingBubble />}
        <div ref={endRef} />
      </div>

      <div
        className="sticky bottom-0 -mx-6 px-6 pt-4 pb-4 backdrop-blur-md"
        style={{
          background:
            "linear-gradient(180deg, transparent, rgba(10,13,20,0.85) 25%)",
        }}
      >
        <div className="card p-2 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask anything about your documents…"
            rows={1}
            className="flex-1 bg-transparent border-none px-3 py-2.5 text-sm resize-none focus:outline-none placeholder:text-muted"
            style={{ minHeight: "44px", maxHeight: "200px" }}
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={!input.trim() || ask.isPending}
            className="btn-primary p-2.5"
            title="Send (Enter)"
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex justify-between items-center mt-3">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-muted hover:text-text inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={12} />
            Back to Documents
          </button>
          <div className="text-muted text-xs">
            <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border font-mono text-[10px]">
              Enter
            </kbd>{" "}
            to send,{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border font-mono text-[10px]">
              Shift+Enter
            </kbd>{" "}
            for newline
          </div>
        </div>
      </div>
    </section>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="card px-4 py-3 text-sm flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-muted animate-typing-dot" />
        <span
          className="w-1.5 h-1.5 rounded-full bg-muted animate-typing-dot"
          style={{ animationDelay: "0.15s" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-muted animate-typing-dot"
          style={{ animationDelay: "0.3s" }}
        />
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const [chunksOpen, setChunksOpen] = useState(false);
  const [entitiesOpen, setEntitiesOpen] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end fade-in">
        <div
          className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm"
          style={{
            background:
              "linear-gradient(180deg, rgba(124,138,255,0.20), rgba(124,138,255,0.10))",
            border: "1px solid rgba(124,138,255,0.30)",
          }}
        >
          {message.text}
        </div>
      </div>
    );
  }

  const { meta } = message;
  return (
    <div className="flex justify-start fade-in">
      <div className="max-w-[92%] w-full card px-5 py-4 text-sm">
        <div className="md leading-relaxed">
          <ReactMarkdown>{message.text}</ReactMarkdown>
        </div>
        {meta && (
          <div className="mt-4 pt-3 border-t border-border space-y-2.5 text-xs">
            <div className="flex flex-wrap gap-2 items-center">
              <span
                className={[
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                  meta.mode === "rag"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-surface-2 border-border text-muted",
                ].join(" ")}
              >
                {meta.mode === "rag" ? (
                  <BookOpen size={11} />
                ) : (
                  <MessageCircle size={11} />
                )}
                {meta.mode === "rag" ? "RAG mode" : "Chat mode"}
              </span>
              <span className="text-muted">
                top relevance{" "}
                <span className="font-mono text-text">
                  {meta.top_score.toFixed(2)}
                </span>
              </span>
              {meta.reranker_used && (
                <span className="text-muted">· reranker</span>
              )}
            </div>
            {meta.warnings.length > 0 && (
              <div className="space-y-1">
                {meta.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="text-amber-400 text-xs flex items-start gap-1.5"
                  >
                    <AlertTriangle
                      size={12}
                      className="flex-shrink-0 mt-0.5"
                    />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
            {meta.extracted_entities.length > 0 && (
              <details
                open={entitiesOpen}
                onToggle={(e) =>
                  setEntitiesOpen((e.target as HTMLDetailsElement).open)
                }
              >
                <summary className="cursor-pointer text-muted hover:text-text inline-flex items-center gap-1.5">
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${
                      entitiesOpen ? "" : "-rotate-90"
                    }`}
                  />
                  Graph entities ({meta.extracted_entities.length})
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {meta.extracted_entities.map((e, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-bg border border-border font-mono text-xs"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </details>
            )}
            {meta.retrieved.length > 0 && (
              <details
                open={chunksOpen}
                onToggle={(e) =>
                  setChunksOpen((e.target as HTMLDetailsElement).open)
                }
              >
                <summary className="cursor-pointer text-muted hover:text-text inline-flex items-center gap-1.5">
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${
                      chunksOpen ? "" : "-rotate-90"
                    }`}
                  />
                  Retrieved chunks ({meta.retrieved.length})
                </summary>
                <div className="mt-3 space-y-2">
                  {meta.retrieved.map((c, i) => {
                    const src =
                      (c.metadata?.source as string | undefined) ?? "?";
                    const page = c.metadata?.page;
                    return (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-bg/60 border border-border"
                      >
                        <div className="text-muted font-mono text-xs mb-2 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-accent-soft text-accent border border-accent-border">
                            [{i + 1}]
                          </span>
                          <span className="truncate">{src}</span>
                          {page !== undefined && page !== "" && (
                            <span>· page {page}</span>
                          )}
                        </div>
                        <div className="text-xs whitespace-pre-wrap leading-relaxed text-text/90">
                          {c.content.length > 700
                            ? c.content.slice(0, 700) + "…"
                            : c.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
