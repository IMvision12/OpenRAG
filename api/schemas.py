"""Pydantic schemas shared between the API and the React frontend."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


# ─── Configuration ─────────────────────────────────────────────────────

class PipelineConfig(BaseModel):
    """Pipeline configuration held server-side. The React UI sends a
    complete copy on every change; the backend rebuilds the cached
    pipeline only when fields actually drift."""

    backend: Literal["vector", "neo4j"] | None = None
    chunking: Literal["fixed", "semantic"] = "fixed"
    top_k: int = 4
    chunk_size: int = 1200
    chunk_overlap: int = 200

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    llm_provider: Literal["huggingface", "ollama"] | None = None
    ollama_model: str = ""
    hf_model: str = ""
    hf_token: str = ""

    # Graph-extraction LLM: open-source providers only. The model runs on
    # the user's own machine (Ollama or HuggingFace) — same as the answer
    # LLM, just configured separately so you can use a different model
    # for extraction (e.g. a tiny one tuned for structured output).
    graph_llm_provider: Literal["none", "ollama", "huggingface"] = "none"
    graph_llm_model: str = ""


class ConfigResponse(BaseModel):
    config: PipelineConfig
    pipeline_active: bool
    missing: list[str] = Field(default_factory=list)


# ─── Presets ───────────────────────────────────────────────────────────

class Presets(BaseModel):
    embedding: list[str]
    hf_llm: list[str]
    ollama_llm: list[str]
    # graph_llm[provider] → list of model presets. Same shape as the answer
    # LLM presets above, just keyed by graph provider so the React UI can
    # populate the dropdown when the user switches between ollama and hf.
    graph_llm: dict[str, list[str]]


# ─── Ingest ────────────────────────────────────────────────────────────

class IngestSummary(BaseModel):
    files: list[str]
    total_chunks: int
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


# ─── Query ─────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    use_rag: bool = False


class RetrievedChunk(BaseModel):
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class QueryResponse(BaseModel):
    answer: str
    mode: Literal["rag", "chat"]
    top_score: float
    reranker_used: bool = False
    graph_backend_used: bool = False
    extracted_entities: list[str] = Field(default_factory=list)
    retrieved: list[RetrievedChunk] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


# ─── HF cache ──────────────────────────────────────────────────────────

class CachedRepo(BaseModel):
    id: str
    type: str
    size: int


class CacheList(BaseModel):
    total_size: int
    repos: list[CachedRepo]


class DeleteResult(BaseModel):
    freed: int
