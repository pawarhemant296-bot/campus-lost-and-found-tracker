#!/usr/bin/env python3
"""
Proves the Node matching engine really consults the Python AI service.

Starts the FastAPI app in a background thread on a free port, asks the Node
engine to score one pair with AI_SERVICE_ENABLED=true, and prints the factor
sources so you can see which score came from the model.

    cd ai-service && .venv/bin/python ../scripts/ai-integration-check.py
"""
from __future__ import annotations

import http.server
import io
import json
import os
import socket
import socketserver
import subprocess
import sys
import threading
import time
import urllib.request
from contextlib import contextmanager
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
AI_DIR = ROOT / "ai-service"
BACKEND_DIR = ROOT / "backend"

sys.path.insert(0, str(AI_DIR))


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


NODE_SNIPPET = r"""
const run = async () => {
  const { scorePairAsync } = await import('./src/matching/engine.js');
  const lost = {
    type: 'lost',
    title: 'Black leather wallet',
    category: 'Wallet / Purse',
    description: 'Black leather wallet with a small tear on the right corner, library card inside',
    location: 'College Canteen, Block B',
    occurred_at: new Date(Date.now() - 6 * 3600e3).toISOString(),
    image_url: null,
  };
  const found = {
    type: 'found',
    title: 'Wallet found in canteen',
    category: 'Wallet / Purse',
    description: 'Black leather wallet on a canteen table, right corner slightly torn, a few cards inside',
    location: 'Canteen, Block B',
    occurred_at: new Date(Date.now() - 4 * 3600e3).toISOString(),
    image_url: null,
  };
  const result = await scorePairAsync(lost, found);
  console.log(JSON.stringify({
    score: result.score,
    ai_used: result.ai_used,
    factors: result.factors.map((factor) => ({ key: factor.key, score: factor.score_pct, source: factor.source ?? null })),
  }));
};
run().catch((error) => { console.error(error.message); process.exit(1); });
"""


IMAGE_VERIFY_SNIPPET = r"""
const run = async () => {
  const { verifyClaimImage } = await import('./src/matching/aiClient.js');
  const item = process.env.ITEM_IMAGE;
  const [same, different, missing] = await Promise.all([
    verifyClaimImage(item, process.env.PROOF_IMAGE),
    verifyClaimImage(item, process.env.OTHER_IMAGE),
    verifyClaimImage(item, null),
  ]);
  console.log(JSON.stringify({ same, different, missing }));
};
run().catch((error) => { console.error(error.message); process.exit(1); });
"""


def _png(colour, size=(120, 120), blob=None):
    from PIL import Image, ImageDraw

    image = Image.new("RGB", size, colour)
    if blob:
        ImageDraw.Draw(image).ellipse(blob, fill=(20, 20, 20))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@contextmanager
def _image_server(images):
    """Serves {path: png_bytes} on a free localhost port for the duration."""

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

        def log_message(self, *args):
            pass

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_address[1]}"
        finally:
            server.shutdown()


def main() -> int:
    import uvicorn  # imported here so the failure message is obvious

    from main import app

    port = free_port()
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    base = f"http://127.0.0.1:{port}"
    deadline = time.time() + 25
    health = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{base}/health", timeout=2) as response:  # noqa: S310
                health = json.loads(response.read())
                break
        except Exception:  # noqa: BLE001
            time.sleep(0.3)

    failures = 0

    def check(label: str, ok: bool, extra: str = "") -> None:
        nonlocal failures
        print(f"   {'✓' if ok else '✗'} {label}{(' ' + extra) if extra else ''}")
        if not ok:
            failures += 1

    print("\n1. AI service")
    check("service is healthy", bool(health), str(health))
    if not health:
        return 1
    print(f"      active text backend: {health['model']}")

    print("\n2. Node engine with AI_SERVICE_ENABLED=true")
    env = {
        **os.environ,
        "AI_SERVICE_ENABLED": "true",
        "AI_SERVICE_URL": base,
        "SQLITE_FILE": "./data/ai-check.db",
    }
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", NODE_SNIPPET],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        print(completed.stdout)
        print(completed.stderr)
        return 1

    payload = json.loads(completed.stdout.strip().splitlines()[-1])
    check("engine reports the AI service was used", payload["ai_used"] is True)
    description = next(factor for factor in payload["factors"] if factor["key"] == "description")
    check(
        "description score is sourced from the model",
        bool(description["source"] and description["source"].startswith("ai:")),
        f"({description['source']}, {description['score']}%)",
    )
    print(f"      combined match score: {payload['score']}%")
    for factor in payload["factors"]:
        print(f"      {factor['key']:<12} {factor['score']:>6}%  source={factor['source'] or '-'}")

    print("\n3. AI image verification for claims")
    item_png = _png((30, 30, 32), blob=(20, 20, 90, 80))
    proof_png = _png((34, 32, 36), blob=(24, 22, 94, 84))
    other_png = _png((240, 240, 250), blob=(5, 5, 20, 20))

    with _image_server({"/item.png": item_png, "/proof.png": proof_png, "/other.png": other_png}) as images:
        verify = subprocess.run(
            ["node", "--input-type=module", "-e", IMAGE_VERIFY_SNIPPET],
            cwd=BACKEND_DIR,
            env={**env, "ITEM_IMAGE": f"{images}/item.png", "PROOF_IMAGE": f"{images}/proof.png", "OTHER_IMAGE": f"{images}/other.png"},
            capture_output=True,
            text=True,
            check=False,
        )
    if verify.returncode != 0:
        print(verify.stdout)
        print(verify.stderr)
        return 1

    verification = json.loads(verify.stdout.strip().splitlines()[-1])
    check(
        "matching proof photo scores high",
        verification["same"]["score"] is not None and verification["same"]["score"] > 0.45,
        f"({verification['same']['score']}, verdict={verification['same']['verdict']})",
    )
    check(
        "unrelated proof photo scores lower",
        verification["different"]["score"] < verification["same"]["score"],
        f"({verification['different']['score']}, verdict={verification['different']['verdict']})",
    )
    check("a claim with no proof photo is skipped", verification["missing"] is None)

    print("\n4. Graceful degradation")
    env_bad = {**env, "AI_SERVICE_URL": "http://127.0.0.1:1"}
    degraded = subprocess.run(
        ["node", "--input-type=module", "-e", NODE_SNIPPET],
        cwd=BACKEND_DIR,
        env=env_bad,
        capture_output=True,
        text=True,
        check=False,
    )
    ok = degraded.returncode == 0
    if ok:
        fallback = json.loads(degraded.stdout.strip().splitlines()[-1])
        check("unreachable AI service falls back to local heuristics", fallback["ai_used"] is False, f"(score {fallback['score']}%)")
    else:
        check("unreachable AI service falls back to local heuristics", False, degraded.stderr[:200])

    server.should_exit = True
    thread.join(timeout=5)

    print("\n" + "=" * 64)
    print("  AI INTEGRATION CHECK PASSED" if failures == 0 else f"  AI INTEGRATION CHECK: {failures} failed")
    print("=" * 64)
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
