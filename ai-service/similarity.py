"""
Similarity backends for the AI matching service.

Three tiers, chosen automatically at start-up. The service is always usable:

  1. sentence-transformers  - true semantic similarity (best; needs the ML extras)
  2. scikit-learn TF-IDF    - character n-gram cosine similarity (good, light)
  3. pure-python fallback   - token overlap, no third-party dependency

Image similarity uses Pillow: a perceptual (average) hash plus a colour
histogram comparison. That is enough to tell "same black wallet" from
"completely different object" without shipping a CNN.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from io import BytesIO
from typing import Optional
from urllib.parse import urlparse
from urllib.request import urlopen

log = logging.getLogger("ai-service.similarity")

# --------------------------------------------------------------------------- #
# Text
# --------------------------------------------------------------------------- #

STOPWORDS = {
    "a", "an", "the", "my", "me", "i", "is", "was", "were", "be", "been", "of",
    "in", "on", "at", "to", "from", "with", "and", "or", "but", "it", "its",
    "this", "that", "for", "by", "near", "around", "about", "there", "here",
    "have", "has", "had", "lost", "found", "item", "please", "someone", "kindly",
}


def _tokens(text: str) -> set[str]:
    cleaned = "".join(char.lower() if char.isalnum() else " " for char in text or "")
    return {word for word in cleaned.split() if len(word) > 1 and word not in STOPWORDS}


def _fallback_similarity(left: str, right: str) -> float:
    """Weighted token overlap - mirrors the JavaScript engine's heuristic."""
    left_tokens, right_tokens = _tokens(left), _tokens(right)
    if not left_tokens or not right_tokens:
        return 0.0
    shared = len(left_tokens & right_tokens)
    dice = (2 * shared) / (len(left_tokens) + len(right_tokens))
    containment = shared / min(len(left_tokens), len(right_tokens))
    return max(0.0, min(1.0, 0.5 * dice + 0.5 * containment))


@dataclass
class TextBackend:
    name: str
    similarity: callable


def load_text_backend(model_name: str = "all-MiniLM-L6-v2") -> TextBackend:
    """Picks the best available text backend without ever failing."""
    try:
        from sentence_transformers import SentenceTransformer, util  # type: ignore

        model = SentenceTransformer(model_name)
        log.info("text backend: sentence-transformers/%s", model_name)

        def semantic(left: str, right: str) -> float:
            embeddings = model.encode([left, right], convert_to_tensor=True, normalize_embeddings=True)
            score = float(util.cos_sim(embeddings[0], embeddings[1]).item())
            # Cosine similarity of normalised embeddings is in [-1, 1].
            return max(0.0, min(1.0, (score + 1) / 2 if score < 0 else score))

        return TextBackend(f"sentence-transformers:{model_name}", semantic)
    except Exception as error:  # noqa: BLE001 - any import/download issue falls through
        log.info("sentence-transformers unavailable (%s)", error)

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore
        from sklearn.metrics.pairwise import cosine_similarity  # type: ignore

        log.info("text backend: scikit-learn TF-IDF")

        def tfidf(left: str, right: str) -> float:
            if not (left or "").strip() or not (right or "").strip():
                return 0.0
            # Character n-grams tolerate typos and different word forms.
            vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)
            matrix = vectorizer.fit_transform([left, right])
            char_score = float(cosine_similarity(matrix[0], matrix[1])[0][0])
            # Blend with word overlap so shared keywords still dominate.
            return max(0.0, min(1.0, 0.6 * char_score + 0.4 * _fallback_similarity(left, right)))

        return TextBackend("sklearn:tfidf-char_wb", tfidf)
    except Exception as error:  # noqa: BLE001
        log.info("scikit-learn unavailable (%s)", error)

    log.info("text backend: pure-python token overlap")
    return TextBackend("fallback:token-overlap", _fallback_similarity)


# --------------------------------------------------------------------------- #
# Images
# --------------------------------------------------------------------------- #

_ALLOWED_SCHEMES = {"http", "https"}
_MAX_IMAGE_BYTES = 6 * 1024 * 1024


def _download(url: str, timeout: float) -> Optional[bytes]:
    parsed = urlparse(url)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        log.warning("refusing non-http(s) image url")
        return None
    try:
        with urlopen(url, timeout=timeout) as response:  # noqa: S310 - scheme checked above
            return response.read(_MAX_IMAGE_BYTES)
    except Exception as error:  # noqa: BLE001
        log.info("image download failed: %s", error)
        return None


def _average_hash(image, size: int = 16) -> list[int]:
    """Classic aHash: downscale to greyscale and threshold at the mean."""
    small = image.convert("L").resize((size, size))
    pixels = list(small.getdata())
    mean = sum(pixels) / len(pixels)
    return [1 if pixel >= mean else 0 for pixel in pixels]


def _histogram_similarity(left, right, buckets: int = 8) -> float:
    """Normalised RGB histogram intersection."""
    def histogram(image):
        small = image.convert("RGB").resize((96, 96))
        counts = [0] * (buckets**3)
        step = 256 // buckets
        for red, green, blue in small.getdata():
            index = (red // step) * buckets * buckets + (green // step) * buckets + (blue // step)
            counts[index] += 1
        total = sum(counts) or 1
        return [count / total for count in counts]

    left_hist, right_hist = histogram(left), histogram(right)
    return sum(min(a, b) for a, b in zip(left_hist, right_hist))


def image_similarity(left_url: str, right_url: str, timeout: float = 6.0) -> Optional[float]:
    """
    Returns 0..1, or None when the images cannot be compared (missing URL,
    download failure, or Pillow not installed). None means "skip this factor".
    """
    if not left_url or not right_url:
        return None
    try:
        from PIL import Image  # type: ignore
    except Exception:  # noqa: BLE001
        log.info("Pillow not installed - image similarity disabled")
        return None

    left_bytes = _download(left_url, timeout)
    right_bytes = _download(right_url, timeout)
    if not left_bytes or not right_bytes:
        return None

    try:
        left_image = Image.open(BytesIO(left_bytes))
        right_image = Image.open(BytesIO(right_bytes))
        left_image.load()
        right_image.load()
    except Exception as error:  # noqa: BLE001
        log.info("could not decode image: %s", error)
        return None

    left_hash = _average_hash(left_image)
    right_hash = _average_hash(right_image)
    matching_bits = sum(1 for a, b in zip(left_hash, right_hash) if a == b)
    hash_score = matching_bits / len(left_hash)
    # aHash agreement is ~0.5 for unrelated images, so rescale to 0..1.
    hash_score = max(0.0, (hash_score - 0.5) / 0.5)

    colour_score = _histogram_similarity(left_image, right_image)

    return max(0.0, min(1.0, 0.6 * hash_score + 0.4 * colour_score))
