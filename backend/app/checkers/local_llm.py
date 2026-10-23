"""Small local model used only for careful grammar fixes.

Runs a GGUF model in-process via llama-cpp-python. The model is small, so it
is used narrowly: fix grammar with minimal edits, and its output is discarded
whenever it strays too far from the input (see ``_is_minimal_edit``).
"""

from __future__ import annotations

import difflib
import logging
import os
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

_DEFAULT_MODEL_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "qwen2.5-0.5b-instruct.gguf"

_SYSTEM_PROMPT = (
    "You correct spelling and grammar mistakes in English text. "
    "Change as few words as possible. Do not rephrase, reorder, shorten or expand. "
    "Keep names, numbers, tone and punctuation style. "
    "If the text is already correct, return it unchanged. "
    "Output only the corrected text."
)

_N_CTX = 2048
# Inputs longer than this are left to LanguageTool alone: the model gets slow
# and less reliable, and prompt + output must fit in the context window.
_MAX_INPUT_TOKENS = 400


def _is_minimal_edit(original: str, fixed: str) -> bool:
    """Accept only light-touch corrections; reject rewrites and hallucinations."""
    a, b = original.split(), fixed.split()
    if not a or not b:
        return False
    if not 0.75 <= len(b) / len(a) <= 1.3:
        return False
    return difflib.SequenceMatcher(None, a, b).ratio() >= 0.7


class LocalGrammarModel:
    """Process-wide wrapper around the local model.

    llama.cpp contexts are not thread-safe — concurrent calls abort the whole
    process — so every call goes through one lock.
    """

    _llm = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self._model_path = os.environ.get("LLM_MODEL_PATH", str(_DEFAULT_MODEL_PATH))

    def is_available(self) -> bool:
        return Path(self._model_path).exists()

    def _get_llm(self):
        # Caller must hold the lock
        if LocalGrammarModel._llm is None:
            from llama_cpp import Llama

            logger.info("Loading local model from %s…", self._model_path)
            LocalGrammarModel._llm = Llama(
                model_path=self._model_path,
                n_ctx=_N_CTX,
                n_threads=max(1, (os.cpu_count() or 2) // 2),
                verbose=False,
            )
            logger.info("Local model loaded.")
        return LocalGrammarModel._llm

    def warm_up(self) -> None:
        """Load the model ahead of the first request (call from a background thread)."""
        if not self.is_available():
            return
        try:
            with self._lock:
                self._get_llm()
        except Exception as exc:
            logger.warning("Could not preload local model: %s", exc)

    def fix_grammar(self, text: str) -> str | None:
        """Return a minimally corrected version of one paragraph, or None to keep it as is."""
        if not text.strip() or not self.is_available():
            return None

        prompt = (
            f"<|im_start|>system\n{_SYSTEM_PROMPT}<|im_end|>\n"
            f"<|im_start|>user\n{text}<|im_end|>\n"
            f"<|im_start|>assistant\n"
        )
        with self._lock:
            llm = self._get_llm()
            n_input = len(llm.tokenize(text.encode("utf-8"), add_bos=False))
            if n_input > _MAX_INPUT_TOKENS:
                return None
            n_prompt = len(llm.tokenize(prompt.encode("utf-8"), add_bos=False, special=True))
            max_tokens = min(int(n_input * 1.3) + 16, _N_CTX - n_prompt - 8)
            if max_tokens <= 0:
                return None
            resp = llm(
                prompt,
                max_tokens=max_tokens,
                temperature=0.0,
                stop=["<|im_end|>", "<|endoftext|>"],
            )

        fixed = resp["choices"][0]["text"].strip().strip('"')
        if not fixed or fixed == text.strip():
            return None
        if not _is_minimal_edit(text, fixed):
            logger.info("Discarded local fix (changed too much): %r -> %r", text, fixed)
            return None
        # Preserve the paragraph's surrounding whitespace
        lead = text[: len(text) - len(text.lstrip())]
        trail = text[len(text.rstrip()):]
        return f"{lead}{fixed}{trail}"
