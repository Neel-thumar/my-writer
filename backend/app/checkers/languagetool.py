"""LanguageTool grammar checker adapter.

Sends text to a LanguageTool HTTP API (typically running in Docker)
and returns categorized suggestions.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from app.api.schemas import Suggestion, SuggestionReplacement

logger = logging.getLogger(__name__)

# Map LanguageTool rule category IDs to our simplified types
_CATEGORY_MAP: dict[str, str] = {
    "TYPOS": "spelling",
    "GRAMMAR": "grammar",
    "PUNCTUATION": "punctuation",
    "STYLE": "style",
    "REDUNDANCY": "style",
    "COLLOQUIALISMS": "style",
    "REPETITIONS": "style",
}


class LanguageToolChecker:
    """Adapter for the LanguageTool HTTP API.

    The API is expected at ``base_url`` (default ``http://localhost:8081``).
    """

    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (
            base_url
            or os.environ.get("LANGUAGETOOL_URL", "http://localhost:8081")
        )
        self._endpoint = f"{self.base_url}/v2/check"

    def check(
        self,
        text: str,
        language: str = "en-US",
        categories: list[str] | None = None,
    ) -> list[Suggestion]:
        """Run a grammar check and return a list of suggestions.

        Args:
            text: Plain text to check.
            language: Language code (e.g. ``en-US``, ``en-GB``).
            categories: Optional filter — only return suggestions matching
                one of these types (spelling, grammar, punctuation, style).
                ``None`` means all categories.
        """
        if not text or not text.strip():
            return []

        try:
            resp = httpx.post(
                self._endpoint,
                data={
                    "text": text,
                    "language": language,
                    "enabledOnly": "false",
                },
                timeout=30.0,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error("LanguageTool HTTP error: %s", exc)
            raise
        except httpx.RequestError as exc:
            logger.error("LanguageTool connection error: %s", exc)
            raise

        data: dict[str, Any] = resp.json()
        matches = data.get("matches", [])

        suggestions: list[Suggestion] = []
        for i, match in enumerate(matches):
            rule = match.get("rule", {})
            category_id = rule.get("category", {}).get("id", "")
            suggestion_type = _CATEGORY_MAP.get(category_id, "style")

            # Filter by category if requested
            if categories is not None and suggestion_type not in categories:
                continue

            replacements = [
                SuggestionReplacement(
                    value=r.get("value", ""),
                    message=r.get("shortMessage"),
                )
                for r in match.get("replacements", [])
            ]

            suggestion = Suggestion(
                id=f"lt-{i}",
                type=suggestion_type,
                message=match.get("message", ""),
                offset=match.get("offset", 0),
                length=match.get("errorLength", 0),
                context=match.get("context", {}).get("text", ""),
                replacements=replacements,
                category_id=category_id,
            )
            suggestions.append(suggestion)

        return suggestions

    def check_paragraph(self, text: str, language: str = "en-US") -> list[Suggestion]:
        """Convenience wrapper — same as ``check`` without category filtering."""
        return self.check(text=text, language=language)

    def is_available(self) -> bool:
        """Quick health check — returns True if LanguageTool is reachable."""
        try:
            resp = httpx.get(f"{self.base_url}/v2/languages", timeout=5.0)
            return resp.status_code == 200
        except Exception:
            return False
