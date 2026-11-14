"""fal client over plain HTTP (httpx), so there is no extra dependency.

FAL_KEY is read from the environment; if unset, from the repo root's local .env
(python-dotenv). The key is never logged.
"""
import os
from pathlib import Path

import httpx

MODELS = {
    "step_picture": "fal-ai/flux/dev",            # ~$0.025/image, same quality as flux-pro 1.1 in our test
    "annotate": "fal-ai/flux-kontext/dev",        # instruction-based image edit
    "clip": "fal-ai/kling-video/v2.1/standard/image-to-video",  # offline library building only
}

STYLE = ("simple flat friendly illustration, thick outlines, soft colours, plain white background, "
         "one clear action, no text, no letters, no numbers")
# Keeps the same person and inhaler across all pictures of a guide.
CHARACTER = ("If a person is shown, they are always the same friendly adult with short dark hair and a green sweater. "
             "If an inhaler is shown, it is always a blue L-shaped metered-dose inhaler with a grey cap")

_BASE = "https://fal.run/"
_ENV_FILES = [Path(__file__).resolve().parent.parent / ".env"]


class MediaError(Exception):
    pass


def _key() -> str:
    key = os.environ.get("FAL_KEY")
    if not key:
        try:
            from dotenv import dotenv_values
            for f in _ENV_FILES:
                if f.exists():
                    key = dotenv_values(f).get("FAL_KEY")
                    if key:
                        break
        except ImportError:
            pass
    if not key:
        raise MediaError("FAL_KEY is not set")
    return key


async def _run(model: str, args: dict, timeout: float = 120) -> dict:
    headers = {"Authorization": f"Key {_key()}"}
    try:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.post(_BASE + model, json=args, headers=headers)
    except httpx.HTTPError as e:
        raise MediaError(f"fal request failed: {type(e).__name__}") from e
    if r.status_code != 200:
        raise MediaError(f"fal {model} returned {r.status_code}: {r.text[:200]}")
    try:
        return r.json()
    except ValueError as e:
        raise MediaError("fal returned invalid JSON") from e


def _first_url(data: dict, field: str = "images") -> str:
    try:
        if field == "video":
            return data["video"]["url"]
        return data[field][0]["url"]
    except (KeyError, IndexError, TypeError) as e:
        raise MediaError("fal response had no media url") from e


async def make_step_picture(picture_prompt: str, seed: int | None = None) -> str:
    """One wordless Easy Read picture for a step. Returns an image URL."""
    if not picture_prompt or not picture_prompt.strip():
        raise MediaError("empty picture_prompt")
    args = {
        "prompt": f"{picture_prompt.strip()}. {CHARACTER}. {STYLE}",
        "image_size": "square_hd",
        "num_images": 1,
        "enable_safety_checker": True,
    }
    if seed is not None:
        args["seed"] = seed
    return _first_url(await _run(MODELS["step_picture"], args))


async def annotate_photo(photo_url: str, labels: list[str]) -> str:
    """Edit the user's photo to add arrows/highlights for each label. Returns an image URL."""
    if not labels:
        raise MediaError("no labels to annotate")
    prompt = ("Keep the photo exactly as it is. Add simple bold arrows and highlight circles "
              f"pointing at these parts: {', '.join(labels)}. Use no text, no letters and no numbers.")
    args = {"prompt": prompt, "image_url": photo_url, "num_images": 1}
    return _first_url(await _run(MODELS["annotate"], args))


async def make_technique_clip(start_image_url: str, motion_prompt: str) -> str:
    """Image-to-video, for building the checked library offline only. Returns a video URL."""
    args = {"prompt": f"{motion_prompt}. No text.", "image_url": start_image_url, "duration": "5"}
    return _first_url(await _run(MODELS["clip"], args, timeout=400), "video")
