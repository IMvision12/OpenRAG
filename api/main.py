"""FastAPI entry point for the React frontend.

Run locally:
    uvicorn api.main:app --reload --port 8000

The React dev server (Vite) runs on :5173 and proxies /api to :8000.
"""

from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .presets import (
    EMBEDDING_PRESETS,
    GRAPH_LLM_PRESETS,
    HF_LLM_PRESETS,
    OLLAMA_LLM_PRESETS,
)
from .schemas import (
    CachedRepo,
    CacheList,
    ConfigResponse,
    DeleteResult,
    IngestSummary,
    PipelineConfig,
    Presets,
    QueryRequest,
    QueryResponse,
    RetrievedChunk,
)
from .state import STATE

app = FastAPI(title="RAG OpenLLMs API", version="1.0.0")

# Local development: React dev server on :5173, prod build served by us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ────────────────────────────────────────────────────────────

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ─── Presets ───────────────────────────────────────────────────────────

@app.get("/api/presets", response_model=Presets)
def get_presets() -> Presets:
    return Presets(
        embedding=EMBEDDING_PRESETS,
        hf_llm=HF_LLM_PRESETS,
        ollama_llm=OLLAMA_LLM_PRESETS,
        graph_llm=GRAPH_LLM_PRESETS,
    )


# ─── Configuration ─────────────────────────────────────────────────────

@app.get("/api/config", response_model=ConfigResponse)
def get_config() -> ConfigResponse:
    return ConfigResponse(
        config=STATE.config,
        pipeline_active=STATE.pipeline is not None,
        missing=STATE.missing_required(),
    )


@app.put("/api/config", response_model=ConfigResponse)
def put_config(cfg: PipelineConfig) -> ConfigResponse:
    STATE.set_config(cfg)
    return ConfigResponse(
        config=STATE.config,
        pipeline_active=STATE.pipeline is not None,
        missing=STATE.missing_required(),
    )


@app.post("/api/reset")
def reset_all() -> dict[str, bool]:
    STATE.reset()
    return {"ok": True}


@app.post("/api/warmup")
def warmup_start() -> dict[str, Any]:
    """Kick off LLM download/load on a background thread.

    Returns immediately with the initial job state. The frontend
    polls `GET /api/warmup/status` for live byte-level progress and
    detects completion (`done: true`) or failure (`error: "..."`).

    Validates the config synchronously up front so missing fields
    surface as a 400 right away instead of a delayed background error.
    """
    miss = STATE.missing_required()
    if miss:
        raise HTTPException(
            status_code=400, detail="Missing required selections: " + ", ".join(miss),
        )
    from .warmup import start as _start
    return _start(STATE)


@app.get("/api/warmup/status")
def warmup_status() -> dict[str, Any]:
    """Live progress of the active warmup. Frontend polls every ~250ms."""
    from .warmup import get_status
    return get_status()


# ─── Ingest ────────────────────────────────────────────────────────────

@app.post("/api/ingest", response_model=IngestSummary)
async def ingest(
    files: list[UploadFile] = File(...),
    recreate: bool = True,
) -> IngestSummary:
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")
    try:
        pipe = STATE.ensure_pipeline()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    summary = IngestSummary(files=[], total_chunks=0)
    tmp_dir = Path(tempfile.mkdtemp(prefix="rag_upload_"))
    try:
        first = True
        for upload in files:
            if not upload.filename:
                continue
            target = tmp_dir / Path(upload.filename).name
            content = await upload.read()
            target.write_bytes(content)
            try:
                # Recreate only on the very first file when recreate=True;
                # subsequent files always append so multiple files
                # accumulate into the same index.
                n = pipe.ingest(target, recreate=recreate and first)
                summary.files.append(upload.filename)
                summary.total_chunks += n
                first = False
                warns = getattr(pipe, "last_ingest_warnings", []) or []
                summary.warnings.extend(warns)
            except Exception as e:
                summary.errors.append(f"{upload.filename}: {e}")
            finally:
                target.unlink(missing_ok=True)

        STATE.ingested_files.extend(summary.files)
        return summary
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ─── Query ─────────────────────────────────────────────────────────────

@app.post("/api/query", response_model=QueryResponse)
def query_endpoint(req: QueryRequest) -> QueryResponse:
    q = (req.question or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Empty question.")
    try:
        pipe = STATE.ensure_pipeline()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    out: dict[str, Any] = pipe.query(q)
    chunks = [
        RetrievedChunk(content=r["content"], metadata=r.get("metadata", {}))
        for r in out.get("retrieved", []) or []
    ]
    return QueryResponse(
        answer=out.get("answer", ""),
        mode=out.get("mode", "chat"),
        top_score=float(out.get("top_score", 0.0)),
        reranker_used=bool(out.get("reranker_used", False)),
        extracted_entities=[
            str(e) for e in (out.get("extracted_entities") or [])
        ],
        retrieved=chunks,
        warnings=list(getattr(pipe, "last_query_warnings", []) or []),
    )


# ─── Debug: inspect the Neo4j graph ────────────────────────────────────

@app.get("/api/debug/graph")
def debug_graph(q: str = "") -> dict[str, Any]:
    """Return a snapshot of the current Neo4j knowledge graph: entity
    counts, sample entity ids, and (if `q` provided) any entities whose
    id case-insensitively contains the query string.

    Useful for diagnosing "graph retrieval returns 0 rows" — you can
    see whether the entities the LLM extracted actually contain the
    name you're searching for.
    """
    try:
        pipe = STATE.ensure_pipeline()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not pipe._use_neo4j:
        raise HTTPException(status_code=400, detail="Neo4j backend not active.")

    try:
        graph = pipe._ensure_neo4j_graph()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Neo4j unavailable: {e}")

    counts = graph.query(
        "MATCH (n) RETURN labels(n) AS labels, count(*) AS n ORDER BY n DESC"
    )
    rel_counts = graph.query(
        "MATCH ()-[r]->() RETURN type(r) AS rel, count(*) AS n ORDER BY n DESC"
    )
    sample = graph.query(
        "MATCH (e:__Entity__) RETURN e.id AS id ORDER BY e.id LIMIT 50"
    )
    matches: list[dict[str, Any]] = []
    if q:
        matches = graph.query(
            "MATCH (e:__Entity__) "
            "WHERE toLower(e.id) CONTAINS toLower($q) "
            "RETURN e.id AS id, labels(e) AS labels LIMIT 50",
            params={"q": q},
        )
    return {
        "label_counts": counts,
        "rel_counts": rel_counts,
        "sample_entities": [r["id"] for r in sample if r.get("id")],
        "matches_for_q": matches,
    }


# ─── HF cache ──────────────────────────────────────────────────────────

def _scan_cache() -> tuple[int, list[CachedRepo]]:
    try:
        from huggingface_hub import scan_cache_dir
        info = scan_cache_dir()
        repos = [
            CachedRepo(
                id=r.repo_id,
                type=r.repo_type,
                size=int(r.size_on_disk),
            )
            for r in info.repos
        ]
        return int(info.size_on_disk), repos
    except Exception:
        return 0, []


@app.get("/api/cache/hf", response_model=CacheList)
def list_hf_cache() -> CacheList:
    total, repos = _scan_cache()
    repos.sort(key=lambda r: -r.size)
    return CacheList(total_size=total, repos=repos)


@app.delete("/api/cache/hf", response_model=DeleteResult)
def delete_all_hf_cache() -> DeleteResult:
    try:
        from huggingface_hub import scan_cache_dir
        info = scan_cache_dir()
        freed = 0
        all_revisions: list[str] = []
        for repo in info.repos:
            for rev in repo.revisions:
                all_revisions.append(rev.commit_hash)
                freed += rev.size_on_disk
        delete = info.delete_revisions(*all_revisions)
        delete.execute()
        return DeleteResult(freed=int(freed))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/cache/hf/{repo_id:path}", response_model=DeleteResult)
def delete_hf_repo(repo_id: str) -> DeleteResult:
    try:
        from huggingface_hub import scan_cache_dir
        info = scan_cache_dir()
        revs: list[str] = []
        freed = 0
        for repo in info.repos:
            if repo.repo_id == repo_id:
                for rev in repo.revisions:
                    revs.append(rev.commit_hash)
                    freed += rev.size_on_disk
        if not revs:
            raise HTTPException(status_code=404, detail=f"{repo_id} not in cache.")
        info.delete_revisions(*revs).execute()
        return DeleteResult(freed=int(freed))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Static frontend (production build) ────────────────────────────────

# Only mount the built React app if it exists. In dev we run Vite separately.
_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"
if _DIST.is_dir():
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="frontend")
