"""Evaluation framework for the RAG pipeline.

Metrics implemented:
  - Retrieval: Precision@k, Recall@k, MRR (Mean Reciprocal Rank)
  - Generation: ROUGE-L, BERTScore
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RetrievalMetrics:
    precision_at_k: float = 0.0
    recall_at_k: float = 0.0
    mrr: float = 0.0


@dataclass
class GenerationMetrics:
    rouge_l_f1: float = 0.0
    bert_score_f1: float = 0.0


@dataclass
class EvalResult:
    question: str
    retrieval: RetrievalMetrics = field(default_factory=RetrievalMetrics)
    generation: GenerationMetrics = field(default_factory=GenerationMetrics)


def compute_retrieval_metrics(
    retrieved_sources: list[str],
    relevant_sources: list[str],
) -> RetrievalMetrics:
    """Compute retrieval quality given retrieved vs ground-truth relevant sources."""
    if not relevant_sources:
        return RetrievalMetrics()

    relevant_set = set(relevant_sources)
    hits = [src in relevant_set for src in retrieved_sources]

    true_positives = sum(hits)
    precision = true_positives / len(retrieved_sources) if retrieved_sources else 0.0
    recall = true_positives / len(relevant_set) if relevant_set else 0.0

    # MRR: reciprocal rank of the first relevant result
    mrr = 0.0
    for i, is_hit in enumerate(hits):
        if is_hit:
            mrr = 1.0 / (i + 1)
            break

    return RetrievalMetrics(precision_at_k=precision, recall_at_k=recall, mrr=mrr)


def compute_generation_metrics(
    prediction: str,
    reference: str,
) -> GenerationMetrics:
    """Compute ROUGE-L and BERTScore between predicted answer and reference answer."""
    metrics = GenerationMetrics()

    # ROUGE-L
    try:
        from rouge_score import rouge_scorer
        scorer = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=True)
        scores = scorer.score(reference, prediction)
        metrics.rouge_l_f1 = scores["rougeL"].fmeasure
    except ImportError:
        pass

    # BERTScore
    try:
        from bert_score import score as bert_score_fn
        _p, _r, f1 = bert_score_fn([prediction], [reference], lang="en", verbose=False)
        metrics.bert_score_f1 = f1.item()
    except ImportError:
        pass

    return metrics


def evaluate(
    question: str,
    prediction: str,
    reference: str,
    retrieved_sources: list[str],
    relevant_sources: list[str],
) -> EvalResult:
    """Full evaluation: retrieval + generation metrics."""
    return EvalResult(
        question=question,
        retrieval=compute_retrieval_metrics(retrieved_sources, relevant_sources),
        generation=compute_generation_metrics(prediction, reference),
    )


# ─── Benchmark runner ──────────────────────────────────────────────────

def run_benchmark(pipeline, benchmark_path: str) -> dict:
    """Run a JSON benchmark of (question, relevant_sources, reference) triples.

    Expected JSON format:
        [
          {
            "question": "What degree is the candidate pursuing?",
            "reference": "MS in Computer Science at CSUF.",
            "relevant_sources": ["Gitesh-Resume.pdf"]
          },
          ...
        ]

    For each item, runs `pipeline.query(question)`, extracts the source files
    from retrieved chunks, and computes retrieval + generation metrics. Returns
    a dict with per-question results and aggregate means.
    """
    import json
    from pathlib import Path

    items = json.loads(Path(benchmark_path).read_text(encoding="utf-8"))
    if not isinstance(items, list):
        raise ValueError("Benchmark JSON must be a list of objects.")

    per_question: list[dict] = []
    for i, item in enumerate(items, start=1):
        question = item.get("question", "")
        reference = item.get("reference", "")
        relevant = item.get("relevant_sources", []) or []
        if not question:
            continue

        out = pipeline.query(question)
        prediction = out.get("answer", "")
        retrieved = out.get("retrieved", []) or []
        retrieved_sources = [
            (r.get("metadata") or {}).get("source", "") for r in retrieved
        ]
        retrieved_sources = [s for s in retrieved_sources if s]

        result = evaluate(
            question=question,
            prediction=prediction,
            reference=reference,
            retrieved_sources=retrieved_sources,
            relevant_sources=relevant,
        )
        per_question.append({
            "index": i,
            "question": question,
            "mode": out.get("mode", ""),
            "top_score": out.get("top_score", 0.0),
            "prediction": prediction,
            "reference": reference,
            "retrieved_sources": retrieved_sources,
            "relevant_sources": relevant,
            "precision_at_k": result.retrieval.precision_at_k,
            "recall_at_k": result.retrieval.recall_at_k,
            "mrr": result.retrieval.mrr,
            "rouge_l_f1": result.generation.rouge_l_f1,
            "bert_score_f1": result.generation.bert_score_f1,
        })

    if not per_question:
        return {"per_question": [], "aggregate": {}, "n": 0}

    def _mean(key: str) -> float:
        vals = [r[key] for r in per_question]
        return sum(vals) / len(vals) if vals else 0.0

    aggregate = {
        "precision_at_k": _mean("precision_at_k"),
        "recall_at_k": _mean("recall_at_k"),
        "mrr": _mean("mrr"),
        "rouge_l_f1": _mean("rouge_l_f1"),
        "bert_score_f1": _mean("bert_score_f1"),
    }
    return {"per_question": per_question, "aggregate": aggregate, "n": len(per_question)}


def format_benchmark_report(results: dict) -> str:
    """Pretty-print benchmark results for a terminal."""
    n = results.get("n", 0)
    if n == 0:
        return "No benchmark items evaluated."
    agg = results["aggregate"]
    lines = [
        f"=== Benchmark results (n={n}) ===",
        "",
        f"{'#':<3} {'mode':<6} {'P@k':>6} {'R@k':>6} {'MRR':>6} {'ROUGE':>7} {'BERT':>7}  question",
        "-" * 100,
    ]
    for r in results["per_question"]:
        q = r["question"][:60].replace("\n", " ")
        lines.append(
            f"{r['index']:<3} {r['mode']:<6} "
            f"{r['precision_at_k']:>6.3f} {r['recall_at_k']:>6.3f} {r['mrr']:>6.3f} "
            f"{r['rouge_l_f1']:>7.3f} {r['bert_score_f1']:>7.3f}  {q}"
        )
    lines += [
        "-" * 100,
        f"{'AVG':<10} "
        f"{agg['precision_at_k']:>6.3f} {agg['recall_at_k']:>6.3f} {agg['mrr']:>6.3f} "
        f"{agg['rouge_l_f1']:>7.3f} {agg['bert_score_f1']:>7.3f}",
        "",
    ]
    return "\n".join(lines)
