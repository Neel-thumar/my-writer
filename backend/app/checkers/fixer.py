"""One-click Fix: correct spelling and grammar locally, as safely as possible.

Layer 1 — LanguageTool: apply the top replacement for each spelling, grammar
and punctuation issue (fast, rule-based, predictable).
Layer 2 — local model (optional): a minimal-edit grammar pass per paragraph,
kept only if LanguageTool finds no more problems in it than before.
"""

from __future__ import annotations

import logging
import re

from app.api.schemas import Suggestion
from app.checkers.languagetool import LanguageToolChecker, utf16_to_index
from app.checkers.local_llm import LocalGrammarModel

logger = logging.getLogger(__name__)

FIX_CATEGORIES = ["spelling", "grammar", "punctuation"]


def is_dictionary_word(s: Suggestion, dictionary: set[str]) -> bool:
    return s.type == "spelling" and (s.error_text or "").strip().lower() in dictionary


def _looks_like_name(s: Suggestion) -> bool:
    """Capitalized "misspellings" are usually names (Neel → Need) — don't auto-fix them.

    They stay underlined in the editor, so the user can still fix one by hand.
    """
    return s.type == "spelling" and (s.error_text or "")[:1].isupper()


def apply_languagetool_fixes(text: str, suggestions: list[Suggestion], dictionary: set[str]) -> tuple[str, int]:
    """Apply each issue's top replacement, back to front so offsets stay valid."""
    candidates = []
    for s in suggestions:
        if s.type not in FIX_CATEGORIES or not s.replacements or s.length <= 0:
            continue
        start = utf16_to_index(text, s.offset)
        end = utf16_to_index(text, s.offset + s.length)
        if text[start:end] != s.error_text or is_dictionary_word(s, dictionary):
            continue
        if _looks_like_name(s):
            continue
        candidates.append((start, end, s.replacements[0].value))

    applied = 0
    lowest = len(text) + 1
    for start, end, replacement in sorted(candidates, reverse=True):
        if end > lowest:
            continue  # overlaps a fix already applied
        text = text[:start] + replacement + text[end:]
        lowest = start
        applied += 1
    return text, applied


def _count_issues(checker: LanguageToolChecker, text: str, language: str, dictionary: set[str]) -> int:
    return sum(
        1
        for s in checker.check(text, language=language, categories=FIX_CATEGORIES)
        if not is_dictionary_word(s, dictionary)
    )


def fix_text(
    text: str,
    checker: LanguageToolChecker,
    model: LocalGrammarModel | None,
    dictionary: set[str],
    language: str = "en-US",
) -> tuple[str, int, int]:
    """Return (fixed_text, languagetool_fix_count, local_ai_paragraph_count)."""
    suggestions = checker.check(text, language=language, categories=FIX_CATEGORIES)
    fixed, lt_count = apply_languagetool_fixes(text, suggestions, dictionary)

    ai_count = 0
    if model is not None and model.is_available():
        # Split on newlines but keep them, so paragraph structure survives exactly
        parts = re.split(r"(\n)", fixed)
        for i, para in enumerate(parts):
            if para == "\n" or not para.strip():
                continue
            try:
                candidate = model.fix_grammar(para)
            except Exception as exc:
                logger.error("Local grammar pass failed: %s", exc)
                break
            if candidate is None:
                continue
            # Keep the model's edit only if it doesn't add problems
            if _count_issues(checker, candidate, language, dictionary) <= _count_issues(
                checker, para, language, dictionary
            ):
                parts[i] = candidate
                ai_count += 1
        fixed = "".join(parts)

    return fixed, lt_count, ai_count
