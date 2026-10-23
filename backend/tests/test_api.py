"""Tests for the document and folder APIs."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.storage.database import Base, get_db

TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture()
def client():
    """Create a fresh test client with an isolated in-memory DB."""
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


def test_create_and_get_document(client):
    resp = client.post("/api/documents", json={"title": "My Essay"})
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["title"] == "My Essay"
    assert doc["word_count"] == 0

    # GET it back
    resp2 = client.get(f"/api/documents/{doc['id']}")
    assert resp2.status_code == 200
    assert resp2.json()["title"] == "My Essay"


def test_update_document_content(client):
    resp = client.post("/api/documents", json={"title": "Test"})
    doc_id = resp.json()["id"]

    # Update with TipTap JSON content
    content = {
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Hello world this is a test"}]}
        ]
    }
    resp = client.put(f"/api/documents/{doc_id}", json={"content": content})
    assert resp.status_code == 200
    assert resp.json()["word_count"] == 6


def test_soft_delete_and_restore(client):
    resp = client.post("/api/documents", json={"title": "To Delete"})
    doc_id = resp.json()["id"]

    # Soft delete
    resp = client.delete(f"/api/documents/{doc_id}")
    assert resp.status_code == 204

    # Should not appear in default list
    resp = client.get("/api/documents")
    assert all(d["id"] != doc_id for d in resp.json())

    # Should appear with include_deleted
    resp = client.get("/api/documents?include_deleted=true")
    assert any(d["id"] == doc_id for d in resp.json())

    # Restore
    resp = client.post(f"/api/documents/{doc_id}/restore")
    assert resp.status_code == 200

    # Now visible again
    resp = client.get("/api/documents")
    assert any(d["id"] == doc_id for d in resp.json())


def test_folder_crud(client):
    # Create
    resp = client.post("/api/folders", json={"name": "Essays"})
    assert resp.status_code == 201
    folder = resp.json()
    assert folder["name"] == "Essays"

    # Create subfolder
    resp = client.post("/api/folders", json={"name": "Drafts", "parent_id": folder["id"]})
    assert resp.status_code == 201
    sub = resp.json()
    assert sub["parent_id"] == folder["id"]

    # List
    resp = client.get("/api/folders")
    assert len(resp.json()) == 2

    # Rename
    resp = client.put(f"/api/folders/{folder['id']}", json={"name": "My Essays"})
    assert resp.json()["name"] == "My Essays"

    # Delete
    resp = client.delete(f"/api/folders/{sub['id']}")
    assert resp.status_code == 204


def test_document_in_folder(client):
    # Create folder
    resp = client.post("/api/folders", json={"name": "Work"})
    folder_id = resp.json()["id"]

    # Create document in folder
    resp = client.post("/api/documents", json={"title": "Report", "folder_id": folder_id})
    assert resp.status_code == 201
    doc = resp.json()
    assert doc["folder_id"] == folder_id

    # Filter by folder
    resp = client.get(f"/api/documents?folder_id={folder_id}")
    assert len(resp.json()) == 1


def test_duplicate_document(client):
    resp = client.post("/api/documents", json={"title": "Original"})
    doc_id = resp.json()["id"]

    resp = client.post(f"/api/documents/{doc_id}/duplicate")
    assert resp.status_code == 201
    copy = resp.json()
    assert copy["title"] == "Original (copy)"
    assert copy["id"] != doc_id


def test_version_history(client):
    # Create doc
    resp = client.post("/api/documents", json={"title": "Versioned"})
    doc_id = resp.json()["id"]

    # Autosave content — should NOT create a version snapshot
    client.put(f"/api/documents/{doc_id}", json={"content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "v1"}]}]}})
    resp = client.get(f"/api/documents/{doc_id}/versions")
    assert resp.status_code == 200
    assert len(resp.json()) == 0

    # Manual save (Ctrl+S / create_version=True) — should create a version snapshot
    client.put(f"/api/documents/{doc_id}", json={"content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "v2"}]}]}, "create_version": True})

    # List versions
    resp = client.get(f"/api/documents/{doc_id}/versions")
    assert resp.status_code == 200
    versions = resp.json()
    assert len(versions) == 1
    # The snapshot holds the content that was just saved, not the previous one
    snap = client.get(f"/api/documents/{doc_id}/versions/{versions[0]['id']}").json()
    assert snap["content"]["content"][0]["content"][0]["text"] == "v2"

    # Pressing Ctrl+S again with no changes doesn't add a duplicate snapshot
    client.put(f"/api/documents/{doc_id}", json={"content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "v2"}]}]}, "create_version": True})
    assert len(client.get(f"/api/documents/{doc_id}/versions").json()) == 1

    # POST /api/documents/{doc_id}/versions snapshot endpoint
    resp2 = client.post(f"/api/documents/{doc_id}/versions")
    assert resp2.status_code == 200
    resp3 = client.get(f"/api/documents/{doc_id}/versions")
    assert len(resp3.json()) == 2


def test_tags(client):
    # Create tag
    resp = client.post("/api/tags", json={"name": "essay"})
    assert resp.status_code == 201
    tag_id = resp.json()["id"]

    # Create document
    resp = client.post("/api/documents", json={"title": "Tagged Doc"})
    doc_id = resp.json()["id"]

    # Assign tag
    resp = client.put(f"/api/tags/documents/{doc_id}", json={"tag_ids": [tag_id]})
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # Get tags for doc
    resp = client.get(f"/api/tags/documents/{doc_id}")
    assert resp.json()[0]["name"] == "essay"


def test_settings(client):
    # Upsert
    resp = client.put("/api/settings", json={"key": "theme", "value": "dark"})
    assert resp.status_code == 200
    assert resp.json()["key"] == "theme"

    # Get
    resp = client.get("/api/settings/theme")
    assert resp.json()["value"] == "dark"

    # List
    resp = client.get("/api/settings")
    assert len(resp.json()) >= 1

    # Delete
    resp = client.delete("/api/settings/theme")
    assert resp.status_code == 204


def test_correct_text_validation(client):
    # Empty text should return 400
    resp = client.post("/api/analyze/correct", json={"text": ""})
    assert resp.status_code == 400

