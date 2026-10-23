# API Client

Typed fetch wrapper for the backend REST API.

## Files

| File | Purpose |
|------|---------|
| `client.ts` | `api` object with typed methods for all backend endpoints |

## Methods

| Method | Backend endpoint |
|--------|-----------------|
| `api.listDocuments(params)` | `GET /api/documents` |
| `api.getDocument(id)` | `GET /api/documents/{id}` |
| `api.createDocument(payload)` | `POST /api/documents` |
| `api.updateDocument(id, payload)` | `PUT /api/documents/{id}` |
| `api.deleteDocument(id, permanent?)` | `DELETE /api/documents/{id}` |
| `api.restoreDocument(id)` | `POST /api/documents/{id}/restore` |
| `api.duplicateDocument(id)` | `POST /api/documents/{id}/duplicate` |
| `api.listFolders(params)` | `GET /api/folders` |
| `api.createFolder(payload)` | `POST /api/folders` |
| `api.updateFolder(id, payload)` | `PUT /api/folders/{id}` |
| `api.deleteFolder(id, permanent?)` | `DELETE /api/folders/{id}` |
| `api.restoreFolder(id)` | `POST /api/folders/{id}/restore` |
| `api.listTags()` | `GET /api/tags` |
| `api.createTag(name)` | `POST /api/tags` |
| `api.setDocumentTags(docId, tagIds)` | `PUT /api/tags/documents/{doc_id}` |
| `api.check(text)` | `POST /api/check` |
| `api.exportDocument(id)` | `GET /api/export/{id}` (returns Blob) |
| `api.importDocument(file)` | `POST /api/export/import` (multipart) |
| `api.listSettings()` | `GET /api/settings` (never includes the AI key) |
| `api.upsertSetting(key, value)` | `PUT /api/settings` |
| `api.fixText(text)` | `POST /api/fix` — local spelling & grammar fix |
| `api.rewriteText(text, tone, instruction?)` | `POST /api/rewrite` — user's own free cloud provider |
| `api.getAiConfig()` / `api.updateAiConfig(data)` | `GET/PUT /api/ai/config` (key is write-only) |
| `api.listAiModels()` | `GET /api/ai/models` — models the saved key can use |

Errors throw `ApiError` with the server's readable `detail` message and `status`.
