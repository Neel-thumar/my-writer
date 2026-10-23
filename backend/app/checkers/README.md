# Checkers

Text-checking and AI adapters, in layers.

| File | Purpose |
|------|---------|
| `languagetool.py` | LanguageTool adapter (local Docker, port 8081). Offsets stay UTF-16 for the editor; `utf16_to_index` converts for Python slicing |
| `fixer.py` | One-click Fix: apply LanguageTool's top fixes (skips names and dictionary words), then optionally a local-model grammar pass kept only if it adds no new issues |
| `local_llm.py` | Small local GGUF model (llama-cpp). One lock around every call (llama.cpp aborts the process on concurrent use); rejects edits that change too much |
| `cloud_ai.py` | Rewrite through any OpenAI-compatible API (Groq, Gemini, OpenRouter free tiers, or a custom URL) using the user's own key |
