# RAG OpenLLMs

Retrieval-Augmented Generation framework using open-source Large Language Models.

Built as a master's project for CPSC 597 at California State University, Fullerton.

## Features

- **Choose your backend** — Chroma (vector DB) for similarity search, or Neo4j (graph DB) for pure knowledge-graph traversal
- **Knowledge-graph construction** — `LLMGraphTransformer` extracts entities and typed relationships from each chunk; Neo4j becomes a connected graph rather than flat storage
- **Cross-encoder reranking + mode gating** — BAAI/bge-reranker-base rescores candidates after bi-encoder retrieval, and the calibrated top score gates between strict RAG mode (cite chunks) and free-form chat mode (no fabricated citations)
- **Multi-format ingestion** — PDF and DOCX with metadata preservation
- **Multiple chunking strategies** — fixed-size or embedding-based semantic (via `SemanticChunker`)
- **Open-source LLMs** — local inference via Ollama (Llama 3, Mistral, etc.) or HuggingFace Transformers (Qwen, Gemma, Falcon, etc.); the graph-extraction LLM is configured separately and can be a smaller/faster model
- **GPU auto-detection** — uses CUDA for embeddings when available, falls back to CPU
- **React + FastAPI web UI** — polished four-step wizard (Home → Configuration → Models → Documents → Chat) with a typed REST API, plus a CLI for scripted runs

## Architecture

```
Document (PDF/DOCX)
    │
    ▼
Document Loader ──► Text Chunking ───────────► Embedding Generation
                    (fixed/SemanticChunker)    (sentence-transformers)
                                            │
                        ┌───────────────────┴───────────────────┐
                        ▼                                       ▼
                   Chroma (vector DB)                   Neo4j (graph DB)
                  similarity search                  entity → Cypher → :MENTIONS
                        │                                       │
                        └───────────────┬───────────────────────┘
                                        ▼     (one backend, chosen at config)
                              Cross-encoder Reranker
                              (BAAI/bge-reranker-base)
                                        │
                                        ▼
                              Mode gate (top score ≥ τ)
                                        │
                                        ▼
                                LLM Generation
                         (Ollama / HuggingFace — local)
                                        │
                                        ▼
                              Answer with citations
```

## Quickstart

### Prerequisites

- **Python 3.10+** with `pip`
- **Node.js 18+** with `npm` (for the web UI)
- **Neo4j 5.x with the APOC plugin installed** — only required if you'll use the `neo4j` backend. APOC is needed for `LLMGraphTransformer` writes.
- **Ollama** — only required if `LLM_PROVIDER=ollama` is selected. Either install it locally or use the cloud-hosted models (e.g. `gpt-oss:20b-cloud`) with a signed-in account.

### 1. Install Python dependencies

```bash
cd rag-openllms
pip install -r requirements.txt
```

### 2. Install web UI dependencies (first run only)

```bash
cd web
npm install
cd ..
```

### 3. Configure environment

Edit `.env` in the project root. The only values that *have* to be
set are Neo4j credentials when using the `neo4j` backend:

```bash
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password   # required when backend = neo4j
```

Everything else (backend, chunking, models, API keys for graph LLMs)
is picked through the web UI at runtime.

### 4. Start the app

**Easiest — Windows PowerShell launcher (starts both servers):**

```powershell
./start_dev.ps1
```

Then open **<http://localhost:5173/>** in your browser. Click "Let's
get started" on the Home screen and walk through the four steps.

**Manual — two terminals:**

```bash
# Terminal 1 — FastAPI backend on :8000
python -m uvicorn api.main:app --reload --port 8000

# Terminal 2 — Vite dev server on :5173 (proxies /api/* → :8000)
cd web
npm run dev
```

Open <http://localhost:5173/> in your browser.

### 5. Production deployment (single process)

Build the frontend once, then run only the FastAPI backend — it
serves the built bundle from `web/dist/` automatically:

```bash
cd web && npm run build && cd ..
python -m uvicorn api.main:app --port 8000
```

Open <http://localhost:8000/> in your browser.

## Usage

The four-step wizard walks you through everything from the browser:

1. **Home** — overview, click *Let's get started*.
2. **Configuration** — pick the retrieval backend (`vector` or
   `neo4j`), chunking strategy, top-k.
3. **Models** — embedding model, answer LLM (Ollama or HuggingFace),
   and (for `neo4j`) the graph-extraction LLM.
4. **Documents** — upload PDFs / DOCXs and ingest into the
   configured stores.
5. **Chat** — ask questions; answers cite chunk numbers in RAG mode
   or fall back to chat mode when no chunk is relevant enough.

The Reset button (top-right) wipes all selections, uploaded files,
chat history, and the cached pipeline — useful when switching
backends or models.

## CLI

The same pipeline is scriptable through a CLI for batch ingest and
query. All examples assume your virtualenv is active.

### Chroma (vector) backend

```bash
# Ingest a PDF
python -m rag_brain --backend vector --ingest "document.pdf"

# Ingest a DOCX
python -m rag_brain --backend vector --ingest "report.docx"

# Ingest with semantic chunking
python -m rag_brain --backend vector --ingest "document.pdf" --chunking semantic

# Append to existing collection instead of rebuilding
python -m rag_brain --backend vector --ingest "document.pdf" --no-recreate

# Query
python -m rag_brain --backend vector --query "What are the key findings?"

# Query with retrieved chunks visible
python -m rag_brain --backend vector --query "What are the key findings?" --show-chunks
```

### Neo4j (graph) backend

```bash
# Ingest a PDF
python -m rag_brain --backend neo4j --ingest "document.pdf"

# Ingest a DOCX
python -m rag_brain --backend neo4j --ingest "report.docx"

# Ingest with semantic chunking
python -m rag_brain --backend neo4j --ingest "document.pdf" --chunking semantic

# Append to existing index instead of rebuilding
python -m rag_brain --backend neo4j --ingest "document.pdf" --no-recreate

# Query
python -m rag_brain --backend neo4j --query "What are the key findings?"

# Query with retrieved chunks visible
python -m rag_brain --backend neo4j --query "What are the key findings?" --show-chunks
```


### Explore the knowledge graph

After ingesting with the `neo4j` backend, browse the extracted entity-relation graph in **Neo4j Browser**:

🔗 **[http://localhost:7474](http://localhost:7474)** (default Neo4j HTTP port — same machine as the bolt URL in `.env`)

Log in with your `NEO4J_USERNAME` / `NEO4J_PASSWORD`, then paste this into the query bar to see the whole graph with all connections:

```cypher
MATCH (n)-[r]-(m) RETURN n, r, m
```

Drag nodes to rearrange, double-click to expand neighbors, scroll to zoom. For larger graphs add `LIMIT 500` at the end to keep the renderer snappy.

## CLI Reference

```
python -m rag_brain [OPTIONS]

Options:
  --backend {vector,neo4j}        Retrieval backend (default: vector)
  --ingest PATH                   Path to PDF or DOCX file to ingest
  --query TEXT                    Question to ask
  --chunking {fixed,semantic}     Chunking strategy (default: fixed)
  --no-recreate                   Add to existing collection instead of rebuilding
  --show-chunks                   Print retrieved chunks as JSON after the answer
```

## Configuration

All settings are read from `.env` in the project root:

| Variable | Default | Description |
|---|---|---|
| `RAG_BACKEND` | `vector` | `vector` or `neo4j` |
| `CHUNKING_STRATEGY` | `fixed` | `fixed` or `semantic` |
| `CHUNK_SIZE` | `1200` | Characters per chunk |
| `CHUNK_OVERLAP` | `200` | Overlap between chunks |
| `TOP_K` | `4` | Number of chunks to retrieve |
| `CHROMA_PERSIST_DIR` | `./data/chroma_db` | Chroma storage path |
| `CHROMA_COLLECTION` | `rag_docs` | Chroma collection name |
| `NEO4J_URI` | `bolt://localhost:7687` | Neo4j connection URI |
| `NEO4J_USERNAME` | `neo4j` | Neo4j username |
| `NEO4J_PASSWORD` | _(required)_ | Neo4j password |
| `NEO4J_DATABASE` | `neo4j` | Neo4j database name |
| `NEO4J_VECTOR_INDEX` | `rag_chunk_vectors` | Neo4j vector index name |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | HuggingFace embedding model |
| `LLM_PROVIDER` | `ollama` | `ollama` or `huggingface` |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `llama3` | Answer LLM (Ollama model name) |
| `HF_MODEL` | `Qwen/Qwen2.5-1.5B-Instruct` | Answer LLM (HuggingFace model ID) |
| `HF_TOKEN` | _(empty)_ | Optional HF token for gated repos; never written to disk |
| `GRAPH_LLM_PROVIDER` | `none` | `none`, `ollama`, or `huggingface` (used only with the `neo4j` backend) |
| `GRAPH_LLM_MODEL` | _(empty)_ | Model name for the chosen graph-LLM provider |
| `GRAPH_LLM_WORKERS` | `1` | Parallel chunks during graph extraction |

## Project Structure

```
rag-openllms/
├── .env                        # Environment-specific configuration
├── start_dev.ps1               # PowerShell launcher (FastAPI + Vite)
├── requirements.txt            # Python dependencies
├── rag_brain/                  # Core RAG package
│   ├── __init__.py             # Package exports + HF log suppression
│   ├── __main__.py             # CLI entry point
│   ├── config.py               # Settings (Pydantic) + enums
│   ├── ingestion.py            # PDF/DOCX loading + chunking
│   ├── embeddings.py           # Embedding model init (GPU auto-detect)
│   └── pipeline.py             # RAGPipeline: ingest, retrieve, rerank, query
├── api/                        # FastAPI backend for the web UI
│   ├── main.py                 # Routes (/api/config, /api/ingest, /api/query, …)
│   ├── state.py                # Process-level pipeline singleton
│   ├── schemas.py              # Pydantic request/response shapes
│   └── presets.py              # Embedding / LLM model preset lists
└── web/                        # React frontend (Vite + TypeScript + Tailwind)
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── main.tsx            # React entrypoint
        ├── App.tsx             # Top-level wizard router
        ├── lib/                # API client + shared types
        ├── components/         # Header, Stepper, Banner, Chip, …
        └── pages/              # Home, Configuration, Models, Documents, Chat
```

## Tech Stack

- **LangChain + LangChain Experimental** — orchestration framework + `SemanticChunker`
- **ChromaDB** — local vector database
- **Neo4j** — graph database with vector index
- **Sentence Transformers** — embedding models (MiniLM, MPNet, BGE)
- **Ollama** — local LLM inference (Llama 3, Mistral, etc.)
- **HuggingFace Transformers** — direct model loading (Qwen, Gemma, Falcon, etc.) via `ChatHuggingFace`
- **PyPDF / python-docx** — document processing
- **FastAPI / React / Vite / Tailwind** — web UI
