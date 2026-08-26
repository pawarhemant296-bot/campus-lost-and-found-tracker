"""
Sanity checks for the AI service.

    pip install -r requirements.txt pytest httpx
    pytest -q
"""
from __future__ import annotations

import http.server
import socketserver
import threading
from io import BytesIO

from fastapi.testclient import TestClient

from main import app
from similarity import image_similarity

client = TestClient(app)

WALLET_LOST = {
    "title": "Black leather wallet",
    "category": "Wallet / Purse",
    "description": "Black leather wallet with a small tear on the right corner, library card inside.",
}
WALLET_FOUND = {
    "title": "Wallet found in canteen",
    "category": "Wallet / Purse",
    "description": "Black leather wallet on a canteen table, right corner slightly torn, a few cards inside.",
}
UNRELATED = {
    "title": "Redmi Note 12 phone",
    "category": "Mobile Phone",
    "description": "Grey Redmi phone with a transparent cover and a cracked screen protector.",
}


def test_health_reports_active_backend():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["model"]


def test_matching_pair_scores_higher_than_unrelated_pair():
    same = client.post("/similarity", json={"lost": WALLET_LOST, "found": WALLET_FOUND}).json()
    other = client.post("/similarity", json={"lost": WALLET_LOST, "found": UNRELATED}).json()

    assert 0.0 <= same["description_similarity"] <= 1.0
    assert same["description_similarity"] > other["description_similarity"], (
        f"wallet pair {same['description_similarity']} should beat unrelated pair {other['description_similarity']}"
    )


def test_image_similarity_is_skipped_without_urls():
    body = client.post("/similarity", json={"lost": WALLET_LOST, "found": WALLET_FOUND}).json()
    assert body["image_similarity"] is None


def test_batch_endpoint():
    payload = [{"lost": WALLET_LOST, "found": WALLET_FOUND}, {"lost": WALLET_LOST, "found": UNRELATED}]
    results = client.post("/similarity/batch", json=payload).json()
    assert len(results) == 2


# --------------------------------------------------------------------------- #
# Image similarity over a temporary local HTTP server
# --------------------------------------------------------------------------- #

def _png(colour, size=(120, 120), blob=None):
    from PIL import Image, ImageDraw

    image = Image.new("RGB", size, colour)
    if blob:
        ImageDraw.Draw(image).ellipse(blob, fill=(20, 20, 20))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_image_similarity_ranks_similar_images_higher():
    images = {
        "/a.png": _png((30, 30, 32), blob=(20, 20, 90, 80)),
        "/b.png": _png((34, 32, 36), blob=(24, 22, 94, 84)),  # nearly the same wallet
        "/c.png": _png((240, 240, 250), blob=(5, 5, 20, 20)),  # completely different
    }

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802 - http.server API
            data = images.get(self.path)
            if data is None:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):  # keep the test output clean
            pass

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{port}"
            similar = image_similarity(f"{base}/a.png", f"{base}/b.png")
            different = image_similarity(f"{base}/a.png", f"{base}/c.png")
        finally:
            server.shutdown()

    assert similar is not None and different is not None
    assert similar > different, f"similar images {similar} should beat different images {different}"
