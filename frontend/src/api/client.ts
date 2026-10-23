/**
 * API client for the Personal Writing Workspace backend.
 * All calls go through the Vite proxy to http://localhost:8000/api.
 */

import type {
  AiConfig,
  CheckResponse,
  Document,
  DictionaryWord,
  FixResponse,
  Folder,
  RewriteResponse,
  Setting,
  Suggestion,
  Tag,
  Version,
} from "../types";

/** An API failure with the server's human-readable message. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const BASE = "/api";

async function fetchJSON<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const resp = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    let message = body || `Request failed (${resp.status})`;
    try {
      const detail = JSON.parse(body).detail;
      if (typeof detail === "string") message = detail;
    } catch {
      // not JSON — keep the raw text
    }
    throw new ApiError(resp.status, message);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const api = {
  // Documents
  async listDocuments(params?: {
    folder_id?: number;
    search?: string;
    include_deleted?: boolean;
    sort?: "updated" | "title" | "word_count";
  }): Promise<Document[]> {
    const q = new URLSearchParams();
    if (params?.folder_id !== undefined) q.set("folder_id", String(params.folder_id));
    if (params?.search) q.set("search", params.search);
    if (params?.include_deleted) q.set("include_deleted", "true");
    if (params?.sort) q.set("sort", params.sort);
    const qs = q.toString();
    return fetchJSON<Document[]>(`${BASE}/documents${qs ? `?${qs}` : ""}`);
  },

  async getDocument(id: number): Promise<Document> {
    return fetchJSON<Document>(`${BASE}/documents/${id}`);
  },

  async createDocument(data: {
    title?: string;
    folder_id?: number | null;
    content?: Record<string, unknown>;
  }): Promise<Document> {
    return fetchJSON<Document>(`${BASE}/documents`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateDocument(
    id: number,
    data: {
      title?: string;
      content?: Record<string, unknown>;
      folder_id?: number | null;
      create_version?: boolean;
    },
  ): Promise<Document> {
    return fetchJSON<Document>(`${BASE}/documents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /** Fire-and-forget save that survives the page closing (keepalive). */
  saveDocumentOnExit(id: number, data: { title?: string; content?: Record<string, unknown> }) {
    fetch(`${BASE}/documents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      keepalive: true,
    }).catch(() => {});
  },

  async createVersion(docId: number): Promise<Version> {
    return fetchJSON<Version>(`${BASE}/documents/${docId}/versions`, {
      method: "POST",
    });
  },

  async deleteDocument(id: number, permanent = false): Promise<void> {
    await fetchJSON<void>(`${BASE}/documents/${id}?permanent=${permanent}`, {
      method: "DELETE",
    });
  },

  async restoreDocument(id: number): Promise<Document> {
    return fetchJSON<Document>(`${BASE}/documents/${id}/restore`, {
      method: "POST",
    });
  },

  async duplicateDocument(id: number): Promise<Document> {
    return fetchJSON<Document>(`${BASE}/documents/${id}/duplicate`, {
      method: "POST",
    });
  },

  // Versions
  async listVersions(docId: number): Promise<Version[]> {
    return fetchJSON<Version[]>(`${BASE}/documents/${docId}/versions`);
  },

  async restoreVersion(docId: number, versionId: number): Promise<Document> {
    return fetchJSON<Document>(
      `${BASE}/documents/${docId}/versions/${versionId}/restore`,
      { method: "POST" },
    );
  },

  // Folders
  async listFolders(includeDeleted = false): Promise<Folder[]> {
    return fetchJSON<Folder[]>(
      `${BASE}/folders${includeDeleted ? "?include_deleted=true" : ""}`,
    );
  },

  async createFolder(name: string, parentId?: number | null): Promise<Folder> {
    return fetchJSON<Folder>(`${BASE}/folders`, {
      method: "POST",
      body: JSON.stringify({ name, parent_id: parentId ?? null }),
    });
  },

  async updateFolder(
    id: number,
    data: { name?: string; parent_id?: number | null },
  ): Promise<Folder> {
    return fetchJSON<Folder>(`${BASE}/folders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteFolder(id: number, permanent = false): Promise<void> {
    await fetchJSON<void>(`${BASE}/folders/${id}?permanent=${permanent}`, {
      method: "DELETE",
    });
  },

  async restoreFolder(id: number): Promise<Folder> {
    return fetchJSON<Folder>(`${BASE}/folders/${id}/restore`, {
      method: "POST",
    });
  },

  // Tags
  async listTags(): Promise<Tag[]> {
    return fetchJSON<Tag[]>(`${BASE}/tags`);
  },

  async createTag(name: string): Promise<Tag> {
    return fetchJSON<Tag>(`${BASE}/tags`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async deleteTag(id: number): Promise<void> {
    await fetchJSON<void>(`${BASE}/tags/${id}`, { method: "DELETE" });
  },

  async getDocumentTags(docId: number): Promise<Tag[]> {
    return fetchJSON<Tag[]>(`${BASE}/tags/documents/${docId}`);
  },

  async setDocumentTags(docId: number, tagIds: number[]): Promise<Tag[]> {
    return fetchJSON<Tag[]>(`${BASE}/tags/documents/${docId}`, {
      method: "PUT",
      body: JSON.stringify({ tag_ids: tagIds }),
    });
  },

  // Check
  async checkText(
    text: string,
    language = "en-US",
    categories?: string[],
  ): Promise<CheckResponse> {
    return fetchJSON<CheckResponse>(`${BASE}/check`, {
      method: "POST",
      body: JSON.stringify({ text, language, categories }),
    });
  },

  // Export / Import
  async exportDocument(id: number): Promise<Blob> {
    const resp = await fetch(`${BASE}/export/${id}`);
    if (!resp.ok) throw new Error("Export failed");
    return resp.blob();
  },

  async importDocument(file: File, folderId?: number): Promise<{ document_id: number; title: string; word_count: number }> {
    const formData = new FormData();
    formData.append("file", file);
    const url = folderId
      ? `${BASE}/export/import?folder_id=${folderId}`
      : `${BASE}/export/import`;
    const resp = await fetch(url, { method: "POST", body: formData });
    if (!resp.ok) throw new Error("Import failed");
    return resp.json();
  },

  // Settings
  async listSettings(): Promise<Setting[]> {
    return fetchJSON<Setting[]>(`${BASE}/settings`);
  },

  async getSetting(key: string): Promise<Setting | null> {
    try {
      return await fetchJSON<Setting>(`${BASE}/settings/${key}`);
    } catch {
      return null;
    }
  },

  async upsertSetting(key: string, value: string): Promise<Setting> {
    return fetchJSON<Setting>(`${BASE}/settings`, {
      method: "PUT",
      body: JSON.stringify({ key, value }),
    });
  },

  async deleteSetting(key: string): Promise<void> {
    await fetchJSON<void>(`${BASE}/settings/${key}`, { method: "DELETE" });
  },

  // Personal Dictionary
  async listDictionaryWords(): Promise<DictionaryWord[]> {
    return fetchJSON<DictionaryWord[]>(`${BASE}/dictionary`);
  },

  async addDictionaryWord(word: string): Promise<DictionaryWord> {
    return fetchJSON<DictionaryWord>(`${BASE}/dictionary`, {
      method: "POST",
      body: JSON.stringify({ word }),
    });
  },

  async deleteDictionaryWord(id: number): Promise<void> {
    await fetchJSON<void>(`${BASE}/dictionary/${id}`, { method: "DELETE" });
  },

  // Fix — local spelling & grammar (nothing leaves this machine)
  async fixText(text: string): Promise<FixResponse> {
    return fetchJSON<FixResponse>(`${BASE}/fix`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },

  // Rewrite — the user's own cloud AI provider, only on explicit request
  async rewriteText(text: string, tone: string, instruction = ""): Promise<RewriteResponse> {
    return fetchJSON<RewriteResponse>(`${BASE}/rewrite`, {
      method: "POST",
      body: JSON.stringify({ text, tone, instruction }),
    });
  },

  async getAiConfig(): Promise<AiConfig> {
    return fetchJSON<AiConfig>(`${BASE}/ai/config`);
  },

  async updateAiConfig(data: {
    provider?: string;
    base_url?: string;
    api_key?: string;
    model?: string;
    local_fix_ai?: boolean;
  }): Promise<AiConfig> {
    return fetchJSON<AiConfig>(`${BASE}/ai/config`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async listAiModels(): Promise<string[]> {
    return fetchJSON<string[]>(`${BASE}/ai/models`);
  },

  // Backup
  async backupAll(folderPath: string): Promise<{ exported: number; skipped: number; backup_dir: string; timestamp: string }> {
    return fetchJSON(`${BASE}/backup`, {
      method: "POST",
      body: JSON.stringify({ folder_path: folderPath }),
    });
  },

  async getBackupPath(): Promise<{ path: string | null }> {
    return fetchJSON(`${BASE}/backup/path`);
  },

  async setBackupPath(path: string): Promise<{ path: string }> {
    return fetchJSON(`${BASE}/backup/path`, {
      method: "PUT",
      body: JSON.stringify({ path }),
    });
  },
};
