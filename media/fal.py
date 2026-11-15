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
    "clip": "fal-ai/kling-video/v2.5-turbo/standard/image-to-video",  # offline library building only, ~$0.21 per 5 s clip
}

# Approved palette: cream #FFF6E9 background, ink #3A2A20 outlines, orange #FF9B3D accent, sage #C9E2D2 and butter #FFE49A fills.
PALETTE = ("flat colour palette of only warm cream background (#FFF6E9), dark brown ink outlines (#3A2A20), "
           "bright orange accent (#FF9B3D), pale sage green (#C9E2D2) and soft butter yellow (#FFE49A) shapes")
STYLE = (f"simple flat friendly vector illustration, thick dark brown outlines, {PALETTE}, "
         "plain solid cream background, one clear action, no text, no letters, no numbers")
# Keeps the same person across all pictures of a guide. Kept generic: naming an object here (we used to name the
# inhaler) makes the model draw it in every picture, even "hold your breath" or a council letter.
CHARACTER = "If a person is shown, they are always the same friendly adult with short dark hair and a sage green sweater"

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


async def annotate_photo(photo_url: str, labels: list[str], numbered: bool = False) -> str:
    """Edit the user's photo to name its parts. Returns an image URL.

    Default: short arrows with the label words written next to each part.
    numbered=True: wordless numbered circles 1..n (the UI shows the legend in the user's language).
    photo_url may be a data URI.
    """
    if not labels:
        raise MediaError("no labels to annotate")
    if numbered:
        listing = "; ".join(f"{i}: {x}" for i, x in enumerate(labels, 1))
        prompt = ("Keep the photo exactly as it is. Add small bold orange numbered circles with a thin line to each part: "
                  f"{listing}. The circles contain only the digit. Do not add any other text.")
    else:
        prompt = ("Keep the photo exactly as it is. Add a short bold orange arrow to each of these parts, "
                  "with its name written next to the arrow in clear large dark letters, spelled exactly: "
                  + ", ".join(f'"{x}"' for x in labels) + ". Add no other text.")
    args = {"prompt": prompt, "image_url": photo_url, "num_images": 1}
    return _first_url(await _run(MODELS["annotate"], args))


async def make_technique_clip(start_image_url: str, motion_prompt: str) -> str:
    """Image-to-video, for building the checked library offline only. Returns a video URL."""
    args = {"prompt": f"{motion_prompt}. No text.", "image_url": start_image_url, "duration": "5"}
    return _first_url(await _run(MODELS["clip"], args, timeout=400), "video")
