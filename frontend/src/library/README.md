# Library

Home, folders, Trash, sidebar and settings.

## Files

| File | Purpose |
|------|---------|
| `LibraryProvider.tsx` | Shared folders/documents/trash state + actions (trash with Undo, move, duplicate…) |
| `Sidebar.tsx` | Resizable, collapsible navigation: search, folder tree, documents, Trash, theme, Settings |
| `HomePage.tsx` | Home (continue writing, folders, all documents), folder pages and Trash |
| `SettingsModal.tsx` | Writing checks, AI (local Fix + free cloud Rewrite), dictionary, backup |
| `TagsPanel.tsx` | Tag chips under the document title |
| `VersionHistoryModal.tsx` | Versions saved with Ctrl+S; restore any of them |

Routes are in the URL hash (`#/`, `#/folder/3`, `#/trash`, `#/doc/12`) — see `hooks/useHashRoute.ts`.
