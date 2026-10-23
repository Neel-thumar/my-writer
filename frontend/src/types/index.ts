export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Document {
  id: number;
  title: string;
  folder_id: number | null;
  content: Record<string, unknown>;
  word_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Version {
  id: number;
  document_id: number;
  saved_at: string;
}

export interface SuggestionReplacement {
  value: string;
  message: string | null;
}

export interface Suggestion {
  id: string;
  type: "spelling" | "grammar" | "punctuation" | "style";
  message: string;
  offset: number;
  length: number;
  context: string;
  error_text?: string;
  replacements: SuggestionReplacement[];
  category_id: string | null;
}

export interface CheckResponse {
  suggestions: Suggestion[];
  language: string;
}

export interface Setting {
  key: string;
  value: string;
}

export interface DictionaryWord {
  id: number;
  word: string;
}

export interface RewriteResponse {
  original: string;
  rewritten: string;
  tone: string;
}

export interface AnalyzeRequest {
  text: string;
}

export interface CorrectVersion {
  title: string;
  description: string;
  text: string;
}

export interface CorrectResponse {
  original: string;
  versions: CorrectVersion[];
}
