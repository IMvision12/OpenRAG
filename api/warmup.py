"""Background warmup with live byte-level download progress.

Runs `RAGPipeline._ensure_llm()` on a daemon thread so the FastAPI
request returns immediately. A tqdm subclass installed on
`huggingface_hub.utils.tqdm` writes byte counters into a shared dict
that the frontend polls via `GET /api/warmup/status` every ~250ms,
yielding a live progress bar identical to the legacy Streamlit UI.

State machine:
    idle -> running -> done
                   \-> error

Only one warmup runs at a time. Re-POSTing to /api/warmup while a
job is active returns the same job's status without restarting.
"""

from __future__ import annotations

import importlib
import logging
import threading
import time
from typing import Any

log = logging.getLogger("rag_brain.api.warmup")


# ─── Shared progress state ──────────────────────────────────────────

_lock = threading.Lock()
_state: dict[str, Any] = {
    "active": False,
    "done": False,
    "error": None,
    "stage": "",            # human-readable: "downloading", "loading", "done"
    "loaded_bytes": 0,      # bytes received so far on the *current* file
    "total_bytes": 0,       # expected bytes for the current file
    "files_total": 0,       # how many files this download covers
    "files_done": 0,        # how many files have finished
    "started_at": 0.0,
}
_thread: threading.Thread | None = None


def get_status() -> dict[str, Any]:
    with _lock:
        s = dict(_state)
    s["elapsed_s"] = (time.time() - s["started_at"]) if s["started_at"] else 0.0
    return s


def _reset_locked() -> None:
    _state.update({
        "active": True,
        "done": False,
        "error": None,
        "stage": "starting",
        "loaded_bytes": 0,
        "total_bytes": 0,
        "files_total": 0,
        "files_done": 0,
        "started_at": time.time(),
    })


def _set_stage(stage: str) -> None:
    with _lock:
        _state["stage"] = stage


# ─── tqdm hook ──────────────────────────────────────────────────────

def _make_progress_tqdm(base_cls):
    """Build a tqdm subclass that mirrors progress into `_state`.

    Defined as a factory so we resolve the base class only when it
    exists in the venv (huggingface_hub). The resulting class behaves
    like normal tqdm — progress bars in stderr still work — while
    additionally writing byte counters to the shared state.
    """

    class _ProgressTqdm(base_cls):  # type: ignore[misc, valid-type]
        # tqdm uses class-level `get_lock`; let the base class manage it.

        def __init__(self, *args, **kwargs):
            unit = kwargs.get("unit") or ""
            self._sl_is_bytes = isinstance(unit, str) and unit.startswith("B")
            # Force enable so HF_HUB_DISABLE_PROGRESS_BARS doesn't suppress us.
            kwargs["disable"] = False
            try:
                super().__init__(*args, **kwargs)
            except TypeError:
                # Some HF tqdm calls pass `name=` which strict tqdm rejects.
                safe = {k: v for k, v in kwargs.items() if k != "name"}
                super().__init__(*args, **safe)
            self.disable = False
            if self._sl_is_bytes:
                with _lock:
                    _state["files_total"] = max(
                        _state["files_total"], _state["files_done"] + 1
                    )
                    _state["stage"] = "downloading"

        def update(self, n=1):
            try:
                super().update(n)
            except Exception:
                pass
            if getattr(self, "_sl_is_bytes", False):
                with _lock:
                    _state["loaded_bytes"] = int(getattr(self, "n", 0) or 0)
                    _state["total_bytes"] = int(getattr(self, "total", 0) or 0)

        def close(self, *args, **kwargs):
            try:
                super().close(*args, **kwargs)
            except Exception:
                pass
            if getattr(self, "_sl_is_bytes", False):
                with _lock:
                    _state["files_done"] += 1

    return _ProgressTqdm


def _install_hf_hook() -> dict[str, Any] | None:
    """Replace huggingface_hub's tqdm so download progress is captured.

    Returns a token dict that `_uninstall_hf_hook` uses to revert. None
    if huggingface_hub isn't importable (then no hook is needed).
    """
    try:
        hf_tqdm_mod = importlib.import_module("huggingface_hub.utils.tqdm")
    except Exception:
        return None

    # Mutate the cached module-level flag — `enable_progress_bars()`
    # respects HF_HUB_DISABLE_PROGRESS_BARS env var, but the actual
    # gate is the module attribute, so we set it directly.
    prev_disabled_flag = getattr(hf_tqdm_mod, "HF_HUB_DISABLE_PROGRESS_BARS", None)
    setattr(hf_tqdm_mod, "HF_HUB_DISABLE_PROGRESS_BARS", False)

    base_cls = getattr(hf_tqdm_mod, "tqdm", None)
    if base_cls is None:
        return {"hf_tqdm_mod": hf_tqdm_mod, "prev_flag": prev_disabled_flag}

    progress_cls = _make_progress_tqdm(base_cls)
    setattr(hf_tqdm_mod, "tqdm", progress_cls)

    # Many HF call sites do `from huggingface_hub.utils import tqdm`
    # at module-import time, capturing the class reference. Rebind in
    # the parent `huggingface_hub.utils` namespace too so freshly
    # imported callers also see the patched class.
    try:
        hf_utils = importlib.import_module("huggingface_hub.utils")
        if getattr(hf_utils, "tqdm", None) is base_cls:
            setattr(hf_utils, "tqdm", progress_cls)
    except Exception:
        pass

    return {
        "hf_tqdm_mod": hf_tqdm_mod,
        "prev_flag": prev_disabled_flag,
        "prev_cls": base_cls,
    }


def _uninstall_hf_hook(token: dict[str, Any] | None) -> None:
    if not token:
        return
    try:
        hf_tqdm_mod = token["hf_tqdm_mod"]
        if "prev_cls" in token:
            setattr(hf_tqdm_mod, "tqdm", token["prev_cls"])
            try:
                hf_utils = importlib.import_module("huggingface_hub.utils")
                if getattr(hf_utils, "tqdm", None) is not token["prev_cls"]:
                    setattr(hf_utils, "tqdm", token["prev_cls"])
            except Exception:
                pass
        if token.get("prev_flag") is not None:
            setattr(hf_tqdm_mod, "HF_HUB_DISABLE_PROGRESS_BARS", token["prev_flag"])
    except Exception as e:
        log.warning("warmup: failed to uninstall HF tqdm hook: %s", e)


# ─── Background runner ──────────────────────────────────────────────

def start(state_singleton) -> dict[str, Any]:
    """Kick off a warmup. If one is already running, return its status."""
    global _thread
    with _lock:
        if _state["active"]:
            return get_status()
        _reset_locked()

    def _run() -> None:
        token = _install_hf_hook()
        try:
            pipe = state_singleton.ensure_pipeline()
            _set_stage("loading")
            pipe._ensure_llm()
            with _lock:
                _state["stage"] = "done"
                _state["done"] = True
                _state["active"] = False
        except Exception as e:  # noqa: BLE001
            log.warning("warmup: failed: %s", e)
            with _lock:
                _state["error"] = str(e)
                _state["stage"] = "error"
                _state["active"] = False
        finally:
            _uninstall_hf_hook(token)

    _thread = threading.Thread(target=_run, daemon=True, name="rag-warmup")
    _thread.start()
    return get_status()
