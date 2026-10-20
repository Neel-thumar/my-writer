# Types

TypeScript type definitions shared across the frontend.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Type definitions for Document, Folder, Tag, Version, Setting, Suggestion, API params |

## Key types

```ts
interface Document {
  id: number;
  title: string;
  folder_id: number | null;
  content: Record<string, any>; // TipTap JSON
  word_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
  deleted_at: string | null;
}

interface Tag { id: number; name: string; }

interface Version {
  id: number;
  document_id: number;
  content: Record<string, any>;
  saved_at: string;
}

interface Suggestion {
  id: string;
  type: "spelling" | "grammar" | "punctuation" | "style";
  message: string;
  context: string;
  replacements: { value: string }[];
}
```

## Latest updates

- Phase 1: all core types defined
- Phase 2: may need `DictionaryWord` and `CheckCategory` types
