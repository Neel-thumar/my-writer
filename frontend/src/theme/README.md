# Theme

Dark/light mode provider with localStorage persistence.

## Files

| File | Purpose |
|------|---------|
| `ThemeProvider.tsx` | React context: `theme` ("light"/"dark"), `toggleTheme()`, applies `dark` class to root |

## How it works

- Theme state stored in `localStorage` key `"theme"`
- On mount, reads from localStorage or defaults to "light"
- Applies Tailwind `dark` class to `<html>` element for dark mode
- `toggleTheme()` switches between light and dark
- Theme button in App top bar (🌙 for light mode, ☀ for dark mode)

## Phase 2 additions needed

- Persist theme preference to backend settings API
- Font family preference (Georgia/Source Serif for text, Inter for menus)
- Focus mode persistence

## Latest updates

- Phase 1: light/dark toggle working with localStorage persistence
- Phase 2: settings API sync needed
