"""Local LLM rewrite adapter — uses llama-cpp-python to rewrite sentences in different tones.

Loads a GGUF model directly (no separate server needed). The model file is
expected at ``data/qwen2.5-0.5b-instruct.gguf`` by default.
"""

from __future__ import annotations

import json
import logging
import os
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class Tone(str, Enum):
    simple = "simple"
    formal = "formal"
    friendly = "friendly"
    concise = "concise"
    academic = "academic"
    creative = "creative"


_TONE_PROMPTS: dict[str, str] = {
    "simple": "Rewrite the following text in clear, simple language that anyone can understand. Keep the meaning the same. Only output the rewritten text, nothing else.\n\n",
    "formal": "Rewrite the following text in a formal, professional tone. Keep the meaning the same. Only output the rewritten text, nothing else.\n\n",
    "friendly": "Rewrite the following text in a warm, friendly, conversational tone. Keep the meaning the same. Only output the rewritten text, nothing else.\n\n",
    "concise": "Rewrite the following text to be more concise. Remove unnecessary words while keeping the meaning. Only output the rewritten text, nothing else.\n\n",
    "academic": "Rewrite the following text in an academic, scholarly tone with precise vocabulary. Keep the meaning the same. Only output the rewritten text, nothing else.\n\n",
    "creative": "Rewrite the following text in a creative, engaging way. Keep the meaning but make it more vivid and interesting. Only output the rewritten text, nothing else.\n\n",
}


class OllamaRewriter:
    """Local LLM rewrite adapter using llama-cpp-python.

    Despite the name (kept for backward compatibility with the route layer),
    this uses llama-cpp-python to run a GGUF model directly — no Ollama server
    needed.
    """

    _instance: "OllamaRewriter | None" = None
    _llm = None

    def __init__(self, base_url: str | None = None) -> None:
        # base_url is ignored — kept for API compatibility with the route layer
        self._model_path = os.environ.get(
            "LLM_MODEL_PATH",
            str(Path(__file__).resolve().parent.parent.parent / "data" / "qwen2.5-0.5b-instruct.gguf"),
        )

    def _get_llm(self):
        """Lazily load the model on first use (loading takes a few seconds)."""
        if OllamaRewriter._llm is None:
            from llama_cpp import Llama
            logger.info("Loading LLM model from %s…", self._model_path)
            OllamaRewriter._llm = Llama(
                model_path=self._model_path,
                n_ctx=2048,
                n_threads=4,
                verbose=False,
            )
            logger.info("LLM model loaded.")
        return OllamaRewriter._llm

    def rewrite(
        self,
        text: str,
        tone: str = "simple",
        model: str = "qwen2.5:0.5b",
    ) -> str:
        """Rewrite text in the given tone using the local LLM.

        Args:
            text: The text to rewrite.
            tone: One of simple, formal, friendly, concise, academic, creative.
            model: Ignored (kept for API compatibility).

        Returns:
            The rewritten text.
        """
        if not text or not text.strip():
            return text or ""

        tone_prompt = _TONE_PROMPTS.get(tone, _TONE_PROMPTS["simple"])
        prompt = f"{tone_prompt}{text}"

        llm = self._get_llm()
        try:
            resp = llm(
                prompt,
                max_tokens=min(500, len(text.split()) * 3),
                temperature=0.7,
                top_p=0.9,
                stop=["\n\n\n", "</s>"],
            )
        except Exception as exc:
            logger.error("LLM generation error: %s", exc)
            raise

        rewritten = resp["choices"][0]["text"].strip()

        # Clean up: remove any leading quotes or labels
        rewritten = rewritten.strip('"').strip("'")
        if rewritten.lower().startswith("rewritten text:"):
            rewritten = rewritten[len("rewritten text:"):].strip()

        if not rewritten:
            return text

        return rewritten

    def is_available(self) -> bool:
        """Check if the model file exists."""
        return Path(self._model_path).exists()

    _CORRECTION_STYLES = [
        {
            "title": "Standard Correction",
            "description": "Fixes spelling, grammar, and punctuation while preserving your voice.",
            "instruction": "You are a professional copy editor. Fix all grammar, spelling, and punctuation errors. Preserve original wording where correct. Output ONLY the final corrected text without any notes, explanations, or quotes.",
            "temperature": 0.2,
        },
        {
            "title": "Polished & Fluent",
            "description": "Fixes errors and refines phrasing for smooth, natural flow.",
            "instruction": "You are a professional editor. Fix all errors and improve phrasing so the text reads smoothly and naturally. Output ONLY the final corrected text without any notes, explanations, or quotes.",
            "temperature": 0.4,
        },
        {
            "title": "Crisp & Concise",
            "description": "Fixes errors and eliminates wordiness, making writing direct.",
            "instruction": "You are a professional editor. Fix all errors and remove wordiness or unnecessary filler, making the text crisp, clear, and direct. Output ONLY the final corrected text without any notes, explanations, or quotes.",
            "temperature": 0.3,
        },
    ]

    def correct(self, text: str, num_versions: int = 3) -> list[dict[str, str]]:
        """Generate multiple corrected versions of the text.

        Args:
            text: The text to correct.
            num_versions: How many corrected versions to generate (1-3).

        Returns:
            A list of dicts with title, description, and text.
        """
        if not text or not text.strip():
            return []

        num_versions = max(1, min(3, num_versions))
        results: list[dict[str, str]] = []

        llm = self._get_llm()
        for i in range(num_versions):
            style = self._CORRECTION_STYLES[i % len(self._CORRECTION_STYLES)]
            prompt = (
                f"<|im_start|>system\n{style['instruction']}<|im_end|>\n"
                f"<|im_start|>user\n{text}<|im_end|>\n"
                f"<|im_start|>assistant\n"
            )
            try:
                resp = llm(
                    prompt,
                    max_tokens=max(100, min(800, len(text.split()) * 3)),
                    temperature=style["temperature"],
                    top_p=0.9,
                    stop=["<|im_end|>", "<|endoftext|>", "</s>", "\n\n\n"],
                )
                corrected = resp["choices"][0]["text"].strip()
                # Clean up any surrounding quotes or accidental prefixes
                corrected = corrected.strip('"').strip("'")
                if corrected.startswith("Corrected:"):
                    corrected = corrected[len("Corrected:"):].strip()

                if corrected:
                    results.append({
                        "title": style["title"],
                        "description": style["description"],
                        "text": corrected,
                    })
            except Exception as exc:
                logger.error("LLM correct error (version %d): %s", i, exc)

        return results

    def analyze(self, text: str) -> list[dict[str, Any]]:
        """Analyze text and return style suggestions.

        Uses the LLM to identify issues like wordiness, passive voice, clarity
        problems, and tone mismatches. Returns a list of suggestion dicts
        with keys: type, message, context, suggestions.

        Args:
            text: The text to analyze.

        Returns:
            A list of suggestion dicts. Empty list if the model fails or
            the text is too short.
        """
        if not text or len(text.strip()) < 10:
            return []

        prompt = (
            "You are a writing style analyzer. Read the following text and "
            "identify style issues. For each issue, output a JSON object on "
            'its own line with keys "type" (one of: style, grammar, punctuation), '
            '"message" (brief explanation), "context" (the exact phrase from the text), '
            'and "suggestion" (an improved version). '
            "Output ONLY the JSON lines, no other text.\n\n"
            "Find at most 5 issues. Focus on clarity, wordiness, passive voice, "
            "and awkward phrasing. Skip spelling.\n\n"
            f"Text:\n{text}\n\n"
            "JSON lines:"
        )

        llm = self._get_llm()
        try:
            resp = llm(
                prompt,
                max_tokens=400,
                temperature=0.3,
                top_p=0.9,
                stop=["\n\n\n", "</s>", "Text:"],
            )
        except Exception as exc:
            logger.error("LLM analysis error: %s", exc)
            return []

        raw = resp["choices"][0]["text"].strip()
        return _parse_json_lines(raw)


def _parse_json_lines(raw: str) -> list[dict[str, Any]]:
    """Parse JSON-lines output from the LLM, tolerating extra text.

    Tries to extract JSON objects from the raw text. Each object should
    have keys: type, message, context, suggestion.
    """
    results: list[dict[str, Any]] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        # Strip common prefixes (markdown code fences, numbering)
        for prefix in ("```json", "```", "1.", "2.", "3.", "4.", "5."):
            if line.startswith(prefix):
                line = line[len(prefix):].strip()
        if not line.startswith("{"):
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict) and "message" in obj:
            results.append(obj)
    return results
