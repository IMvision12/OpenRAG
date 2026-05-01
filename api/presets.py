"""Hard-coded model preset lists exposed to the React UI via /api/presets."""

EMBEDDING_PRESETS = [
    "sentence-transformers/all-MiniLM-L6-v2",
    "sentence-transformers/all-mpnet-base-v2",
    "BAAI/bge-small-en-v1.5",
    "BAAI/bge-base-en-v1.5",
    "BAAI/bge-large-en-v1.5",
    "intfloat/e5-base-v2",
]

HF_LLM_PRESETS = [
    "Qwen/Qwen2.5-1.5B-Instruct",
    "Qwen/Qwen2.5-3B-Instruct",
    "Qwen/Qwen2.5-7B-Instruct",
    "meta-llama/Llama-3.2-1B-Instruct",
    "meta-llama/Llama-3.2-3B-Instruct",
    "microsoft/Phi-3.5-mini-instruct",
    "google/gemma-2-2b-it",
    "google/gemma-2-9b-it",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "tiiuae/falcon-7b-instruct",
]

OLLAMA_LLM_PRESETS = [
    # Cloud-hosted (`:cloud` suffix) — no local pull needed. Requires a
    # signed-in Ollama account with credits; runs on Ollama's infra.
    "kimi-k2.5:cloud",
    "glm-5:cloud",
    "minimax-m2.7:cloud",
    "gemma4:31b-cloud",
    "qwen3.5:397b-cloud",
    "gpt-oss:120b-cloud",
    "gpt-oss:20b-cloud",
    # Local (pull via `ollama pull <name>`).
    "gpt-oss:120b",
    "gpt-oss:20b",
    "gemma4:31b",
    "gemma4:26b",
    "gemma4:e4b",
    "gemma4:e2b",
    "deepseek-r1:8b",
    "qwen3:0.6b",
]

# Graph-extraction LLM presets — open-source providers only, mirror the
# answer-LLM preset lists above. Any model usable as the answer LLM is
# usable for extraction; smaller, faster ones are usually a better choice
# here since extraction runs once per chunk at ingest time.
GRAPH_LLM_PRESETS: dict[str, list[str]] = {
    "ollama": OLLAMA_LLM_PRESETS,
    "huggingface": HF_LLM_PRESETS,
}
