"""fal client over plain HTTP (httpx), so there is no extra dependency.

FAL_KEY is read from the environment; if unset, from the repo root's local .env
(python-dotenv). The key is never logged.
"""
import os
import re
from pathlib import Path

import httpx

MODELS = {
    # Plain text-to-image: step pictures are close-ups of hands + the one object, so no person reference is needed
    # (the live guide avatar is the only person on screen). flux/schnell: about $0.003 per 1 MP image, 1-3 s.
    # Before: fal-ai/nano-banana/edit with the guide portrait as reference (~$0.04, 9-13 s), which drew the whole guide.
    "step_picture": "fal-ai/flux/schnell",
    "annotate": "fal-ai/flux-kontext/dev",        # instruction-based image edit
    "clip": "fal-ai/kling-video/v2.5-turbo/standard/image-to-video",  # offline library building only, ~$0.21 per 5 s clip
}

# Same palette as the animated close-ups (web/src/closeups/parts.tsx): sand card, cream glow, orange accent,
# warm brown skin, sage sleeve.
PALETTE = ("flat colour palette of only warm sand background (#FCEBD6) with a soft cream glow (#FFF6EA), "
           "dark brown ink outlines (#3A2A20), bright orange accent (#F5973F), pale sage green (#DCEBDF), "
           "warm brown skin (#B5744A) and a sage green sleeve cuff (#93A27A)")
# What the picture may and may not show. A person in the picture competes with the live guide on screen.
CLOSEUP = ("Close-up view: only hands and the one object the step is about, filling the frame. "
           "If hands are shown, they have warm brown skin and a sage green sleeve cuff at the wrist. "
           "No person, no face, no head, no body, no shoulders, no people in the background, "
           "no room, no furniture, no decoration")
# Wordless: any paper, screen or page shows plain lines or blocks only (the model otherwise writes the
# sender's name, badly spelt, on the letter).
NO_TEXT = ("Wordless picture: no text, no letters, no numbers, no words, no title, no logos. "
           "Any paper, page, card or screen shows only plain grey lines and small coloured blocks instead of writing")
STYLE = (f"simple flat friendly vector illustration, thick dark brown outlines, {PALETTE}, "
         "plain solid background, one clear action, no text, no letters, no numbers")

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


# Words in the step prompt that make the model write on the paper ("a letter from the benefits office" puts
# "Benefits office" on the letter; "write a date" puts "2023" in the diary). The object stays, the words go.
_SENDER = re.compile(r"\s*\b(?:from|by|sent by)\s+(?:the\s+|a\s+|an\s+|your\s+)?[\w' -]*?"
                     r"\b(?:office|council|hospital|surgery|school|college|company|bank|department|dwp|hmrc|nhs|gp|"
                     r"pharmacy|clinic|jobcentre|centre|center|provider|landlord|agency|service)s?\b", re.I)
_WORDY = re.compile(r"\b(?:(?:a|the|your|their|its)\s+)?(?:date|dates|name|names|number|numbers|address|title|"
                    r"amount|reference|signature|words?|text|day|month|year|time|january|february|march|april|june|july|august|"
                    r"september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b"
                    r"|\b(?:saying|that says|labelled|labeled|titled|with the words)\b[^,.]*", re.I)
_QUOTED = re.compile(r"[\"\u201c\u201d'\u2018\u2019][^\"\u201c\u201d]{1,60}?[\"\u201c\u201d'\u2018\u2019]|\d+")


# A named person becomes hands: the live guide is the only person on screen.
_PERSON = re.compile(r"\b(?:an?|the|one|your)?\s*(?:old(?:er)?\s+|young\s+)?(?:person|woman|man|lady|patient|someone|"
                     r"people|parent|child|doctor|nurse|pharmacist|guide|reader|user)\b(?:'s)?", re.I)


def wordless(picture_prompt: str) -> str:
    """The step prompt without the bits the model would write as text (senders, dates, names, quotes, digits)."""
    t = _QUOTED.sub(" ", picture_prompt)
    t = _SENDER.sub("", t)
    t = _PERSON.sub(" hands", t)
    t = _WORDY.sub("", t)
    t = re.sub(r"\s+([,.])", r"\1", re.sub(r"\s{2,}", " ", t)).strip(" ,.")
    return t or "two hands holding a sheet of paper"


def step_picture_prompt(picture_prompt: str) -> str:
    """The full prompt for a step picture: the step's own object/action, as a hands-and-object close-up."""
    return f"{NO_TEXT}. Close-up picture: {wordless(picture_prompt)}. {CLOSEUP}. {STYLE}"


async def make_step_picture(picture_prompt: str, seed: int | None = None) -> str:
    """One wordless close-up picture for a step: hands + the object only, no person. Returns an image URL."""
    if not picture_prompt or not picture_prompt.strip():
        raise MediaError("empty picture_prompt")
    args = {
        "prompt": step_picture_prompt(picture_prompt),
        "image_size": "square",  # 512x512: about a quarter of the 1 MP price, plenty for a phone card
        "num_inference_steps": 4,
        "num_images": 1,
        "output_format": "png",
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
