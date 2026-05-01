"""Process-level singleton holding the active pipeline + current config.

The FastAPI app is single-process (uvicorn worker); we keep one
RAGPipeline alive across requests so heavy resources (Chroma client,
HF model weights, reranker) survive between calls. The pipeline is
rebuilt only when a config change makes the cached one stale.
"""

from __future__ import annotations

import gc
from threading import Lock

from rag_brain.config import ChunkingStrategy, RetrievalBackend, Settings, load_settings
from rag_brain.pipeline import RAGPipeline

from .schemas import PipelineConfig


class PipelineState:
    def __init__(self) -> None:
        self.config: PipelineConfig = PipelineConfig()
        self.pipeline: RAGPipeline | None = None
        self.last_signature: tuple | None = None
        self.ingested_files: list[str] = []
        self._lock = Lock()

    # ── Config ────────────────────────────────────────────────────────

    def set_config(self, cfg: PipelineConfig) -> None:
        with self._lock:
            self.config = cfg
            if self.pipeline is not None and not self._matches(self.pipeline, cfg):
                self._invalidate_unlocked()

    def missing_required(self) -> list[str]:
        c = self.config
        miss: list[str] = []
        if not c.backend:
            miss.append("backend (Step 1)")
        if not c.llm_provider:
            miss.append("LLM provider (Step 2)")
        elif c.llm_provider == "ollama" and not c.ollama_model:
            miss.append("Ollama model (Step 2)")
        elif c.llm_provider == "huggingface" and not c.hf_model:
            miss.append("HuggingFace model (Step 2)")
        if c.backend in ("neo4j", "both") and c.graph_llm_provider != "none":
            if not c.graph_llm_model:
                miss.append("Graph LLM model (Step 2)")
        return miss

    # ── Pipeline lifecycle ────────────────────────────────────────────

    def ensure_pipeline(self) -> RAGPipeline:
        miss = self.missing_required()
        if miss:
            raise ValueError("Missing required selections: " + ", ".join(miss))
        with self._lock:
            if self.pipeline is not None and self._matches(self.pipeline, self.config):
                return self.pipeline
            if self.pipeline is not None:
                self._invalidate_unlocked()
            self.pipeline = self._build_unlocked(self.config)
            return self.pipeline

    def reset(self) -> None:
        with self._lock:
            self._invalidate_unlocked()
            self.config = PipelineConfig()
            self.ingested_files = []

    # ── Internal helpers ──────────────────────────────────────────────

    def _invalidate_unlocked(self) -> None:
        pipe = self.pipeline
        if pipe is not None:
            try:
                pipe._release_chroma()
            except Exception:
                pass
        self.pipeline = None
        self.last_signature = None
        gc.collect()

    @staticmethod
    def _build_unlocked(c: PipelineConfig) -> RAGPipeline:
        base = load_settings()
        data = base.model_dump()
        data.update(
            {
                "retrieval_backend": RetrievalBackend(c.backend),
                "chunking_strategy": ChunkingStrategy(c.chunking),
                "top_k": int(c.top_k),
                "chunk_size": int(c.chunk_size),
                "chunk_overlap": int(c.chunk_overlap),
                "embedding_model": c.embedding_model,
                "llm_provider": c.llm_provider,
                "ollama_model": c.ollama_model or "",
                "hf_model": c.hf_model or "",
                "hf_token": c.hf_token or "",
                "graph_llm_provider": c.graph_llm_provider,
                "graph_llm_model": c.graph_llm_model or "",
            }
        )
        return RAGPipeline(Settings(**data))

    @staticmethod
    def _enum_val(x) -> str:
        return getattr(x, "value", x) if not isinstance(x, str) else x

    def _matches(self, pipe: RAGPipeline, c: PipelineConfig) -> bool:
        s = pipe.settings
        if not c.backend or not c.llm_provider:
            return False
        if s.llm_provider.lower() != c.llm_provider.lower():
            return False
        if self._enum_val(s.retrieval_backend) != c.backend:
            return False
        if self._enum_val(s.chunking_strategy) != c.chunking:
            return False
        if s.embedding_model != c.embedding_model:
            return False
        if s.llm_provider.lower() == "ollama" and s.ollama_model != (c.ollama_model or ""):
            return False
        if s.llm_provider.lower() == "huggingface" and s.hf_model != (c.hf_model or ""):
            return False
        if (s.graph_llm_provider or "none").lower() != (c.graph_llm_provider or "none").lower():
            return False
        if (s.graph_llm_model or "") != (c.graph_llm_model or ""):
            return False
        return True


STATE = PipelineState()
