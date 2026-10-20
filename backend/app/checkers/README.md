# Checkers

Grammar checking adapters. The adapter pattern lets us swap engines without changing the API layer.

## Files

| File | Purpose |
|------|---------|
| `languagetool.py` | LanguageTool adapter — sends text to LanguageTool Docker container, normalizes response |

## How it works

1. Frontend sends plain text to `/api/check`
2. `routes_check.py` calls the LanguageTool adapter
3. Adapter POSTs to LanguageTool server (default: `http://localhost:8081`)
4. Response is normalized into a standard suggestion format:
   - `type`: spelling, grammar, punctuation, style
   - `message`: description
   - `context`: the text span flagged
   - `replacements`: list of suggested fixes

## Future

- Phase 3: Ollama adapter for sentence rewriting and tone suggestions
- The adapter pattern means we can add new checkers without touching the API layer

## Latest updates

- Phase 1: LanguageTool adapter complete
- Phase 2: check category toggles (spelling/grammar/punctuation/style on/off) needed
