# Suggestions

Grammar suggestion provider, popup, and keyboard navigation.

## Files

| File | Purpose |
|------|---------|
| `SuggestionsProvider.tsx` | React context: holds suggestions, checking state, debounced checkText, accept handler |
| `SuggestionPopup.tsx` | Popup showing suggestion details with accept/ignore buttons |

## How it works

1. Editor `onUpdate` triggers a debounced `checkText()` (600ms delay)
2. `checkText()` sends plain text to `/api/check` backend endpoint
3. Response is stored in context as `suggestions[]`
4. Bottom panel lists all suggestions, color-coded by type
5. Clicking a suggestion opens the popup
6. Accept replaces the flagged text in the editor via the accept handler
7. Ignore dismisses the popup

## Suggestion types (color-coded)

| Type | Color class |
|------|------------|
| Spelling | `suggestion-spelling` (red) |
| Grammar | `suggestion-grammar` (blue) |
| Punctuation | `suggestion-punctuation` (amber) |
| Style | `suggestion-style` (purple) |

## Keyboard shortcuts

- **Alt+↓** — cycle to next suggestion
- **Ctrl+Enter** — accept first replacement for active suggestion
- **Esc** — dismiss popup

## Phase 2 additions needed

- Personal dictionary integration (accepted words never flagged)
- Check category toggles (enable/disable spelling, grammar, etc.)
- Suggestion underlines (decorations on the text itself)

## Latest updates

- Phase 1: provider, popup, keyboard nav all working
- Phase 2: personal dictionary, category toggles, text decorations needed
