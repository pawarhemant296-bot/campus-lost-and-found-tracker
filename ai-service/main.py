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


class ImageVerifyRequest(BaseModel):
    """A claimant's proof photo versus the photo on the item report."""

    item_image_url: Optional[str] = None
    proof_image_url: Optional[str] = None


class ImageVerifyResponse(BaseModel):
    image_similarity: Optional[float] = Field(None, ge=0, le=1)
    verdict: str
    model: str
    took_ms: int


# Verdict bands for claim review. Deliberately conservative: the service never
# decides a claim, it only tells the reviewer how strongly the photos agree.
MATCH_THRESHOLD = float(os.getenv("AI_IMAGE_MATCH_THRESHOLD", "0.72"))
POSSIBLE_THRESHOLD = float(os.getenv("AI_IMAGE_POSSIBLE_THRESHOLD", "0.45"))


def _verdict(score: Optional[float]) -> str:
    if score is None:
        return "unavailable"
    if score >= MATCH_THRESHOLD:
        return "likely_same_item"
    if score >= POSSIBLE_THRESHOLD:
        return "possibly_same_item"
    return "likely_different_item"


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


@app.post("/verify-image", response_model=ImageVerifyResponse)
def verify_image(request: ImageVerifyRequest) -> ImageVerifyResponse:
    """
    Ownership verification aid: compares the photo a claimant uploaded as proof
    with the photo on the item report.

    Returns a similarity plus a plain-language verdict. `unavailable` means the
    comparison could not be made (missing photo, download failure, Pillow
    absent) - the backend then simply omits this evidence.
    """
    started = time.perf_counter()

    score: Optional[float] = None
    if IMAGE_MATCHING_ENABLED:
        try:
            score = image_similarity(request.item_image_url, request.proof_image_url, IMAGE_TIMEOUT)
        except Exception as error:  # noqa: BLE001 - never fail a claim submission
            log.exception("image verification failed: %s", error)
            score = None

    return ImageVerifyResponse(
        image_similarity=None if score is None else max(0.0, min(1.0, score)),
        verdict=_verdict(score),
        model="image:ahash+histogram",
        took_ms=int((time.perf_counter() - started) * 1000),
    )


@app.post("/similarity/batch")
def similarity_batch(requests: list[SimilarityRequest]) -> list[SimilarityResponse]:
    """Convenience endpoint for re-scoring many pairs at once."""
    return [similarity(entry) for entry in requests]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
