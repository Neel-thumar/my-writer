# Suggestions

Grammar suggestions from the local LanguageTool check.

## Files

| File | Purpose |
|------|---------|
| `SuggestionsProvider.tsx` | Context: current suggestions, check sequencing (stale results dropped), ignore list (localStorage), accept handlers |
| `SuggestionsPanel.tsx` | Resizable right-hand Review panel: issues, one-click replacements, Fix all typos, Ignore all |
| `SuggestionPopup.tsx` | Popup for a clicked underline: replacements, Ignore (Esc / click-away just closes) |
