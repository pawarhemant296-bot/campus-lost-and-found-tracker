"""
Lost & Found Item Tracker - optional AI matching service (spec phase 9).

The Node backend calls POST /similarity for two factors only: semantic
description similarity and image similarity. Everything else (weights, storage,
notifications) stays in the backend, so this service can be switched off at any
time without changing behaviour - the backend simply falls back to its own
heuristics.

Run:
    pip install -r requirements.txt
    uvicorn main:app --port 8000
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

from similarity import image_similarity, load_text_backend

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("ai-service")

MODEL_NAME = os.getenv("AI_TEXT_MODEL", "all-MiniLM-L6-v2")
IMAGE_TIMEOUT = float(os.getenv("AI_IMAGE_TIMEOUT", "6"))
IMAGE_MATCHING_ENABLED = os.getenv("AI_IMAGE_MATCHING", "true").lower() in {"1", "true", "yes"}

app = FastAPI(
    title="Lost & Found AI Matching Service",
    version="1.0.0",
    description="Semantic description similarity and image similarity for the Lost & Found Item Tracker.",
)

# Loaded once at import time; falls back gracefully when ML extras are absent.
TEXT_BACKEND = load_text_backend(MODEL_NAME)


class ItemPayload(BaseModel):
    title: str = ""
    description: str = ""
    category: str = ""
    image_url: Optional[str] = None


class SimilarityRequest(BaseModel):
    lost: ItemPayload
    found: ItemPayload


class SimilarityResponse(BaseModel):
    description_similarity: float = Field(..., ge=0, le=1)
    image_similarity: Optional[float] = Field(None, ge=0, le=1)
    model: str
    took_ms: int


def _text_of(item: ItemPayload) -> str:
    return " ".join(part for part in (item.title, item.category, item.description) if part).strip()


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "lost-found-ai",
        "model": TEXT_BACKEND.name,
        "image_matching": IMAGE_MATCHING_ENABLED,
    }


@app.post("/similarity", response_model=SimilarityResponse)
def similarity(request: SimilarityRequest) -> SimilarityResponse:
    """Scores one lost/found pair. Never raises: a failure returns 0/None."""
    started = time.perf_counter()

    try:
        description_score = float(TEXT_BACKEND.similarity(_text_of(request.lost), _text_of(request.found)))
    except Exception as error:  # noqa: BLE001 - the backend must stay reachable
        log.exception("text similarity failed: %s", error)
        description_score = 0.0

    image_score: Optional[float] = None
    if IMAGE_MATCHING_ENABLED:
        try:
            image_score = image_similarity(request.lost.image_url, request.found.image_url, IMAGE_TIMEOUT)
        except Exception as error:  # noqa: BLE001
            log.exception("image similarity failed: %s", error)
            image_score = None

    return SimilarityResponse(
        description_similarity=max(0.0, min(1.0, description_score)),
        image_similarity=None if image_score is None else max(0.0, min(1.0, image_score)),
        model=TEXT_BACKEND.name,
        took_ms=int((time.perf_counter() - started) * 1000),
    )


@app.post("/similarity/batch")
def similarity_batch(requests: list[SimilarityRequest]) -> list[SimilarityResponse]:
    """Convenience endpoint for re-scoring many pairs at once."""
    return [similarity(entry) for entry in requests]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
