#!/usr/bin/env python3
"""List Anam voices and suggest candidates for each Easy Read language.

Usage (reads ANAM_API_KEY from the environment only; the key is never printed):
    ANAM_API_KEY=... python tools/anam_voices.py [--top 5] [--langs es,ar,ur,pl,bn]

Calls GET https://api.anam.ai/v1/voices (paginated: page, perPage up to 100; response {data, meta}).
Each voice has id, displayName, provider, gender (MALE/FEMALE/NEUTRAL/null), description, languages (ISO 639-1).
Then set ANAM_VOICE_ID_<LANG> (e.g. ANAM_VOICE_ID_ES) to the chosen id.
"""
import argparse, os, sys
import httpx

URL = "https://api.anam.ai/v1/voices"
LANGS = ["es", "ar", "ur", "pl", "bn"]
WARM = ("warm", "calm", "friendly", "gentle", "soft", "kind", "soothing", "caring", "reassuring", "natural")
COOL = ("aggressive", "energetic", "shout", "excited", "villain", "robot", "gruff", "deep")


def fetch_all(key: str, client=None) -> list[dict]:
    own = client is None
    client = client or httpx.Client(timeout=30)
    voices, page = [], 1
    try:
        while page:
            r = client.get(URL, params={"page": page, "perPage": 100}, headers={"Authorization": f"Bearer {key}"})
            r.raise_for_status()
            body = r.json()
            voices += body.get("data", [])
            page = (body.get("meta") or {}).get("next")
    finally:
        if own:
            client.close()
    return voices


def score(v: dict) -> int:
    text = f"{v.get('displayName') or ''} {v.get('description') or ''} {' '.join(v.get('displayTags') or [])}".lower()
    s = 3 if (v.get("gender") or "").upper() == "FEMALE" else 0
    s += sum(2 for w in WARM if w in text) - sum(2 for w in COOL if w in text)
    return s


def candidates(voices: list[dict], lang: str, top: int = 5) -> list[dict]:
    pool = [v for v in voices if lang in (v.get("languages") or [])]
    return sorted(pool, key=lambda v: (-score(v), v.get("displayName") or ""))[:top]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--langs", default=",".join(LANGS))
    a = ap.parse_args(argv)
    key = os.environ.get("ANAM_API_KEY")
    if not key:
        print("Set ANAM_API_KEY in the environment.", file=sys.stderr)
        return 1
    try:
        voices = fetch_all(key)
    except httpx.HTTPError as e:
        print(f"Anam request failed: {type(e).__name__}", file=sys.stderr)  # never echo headers or the key
        return 1
    print(f"{len(voices)} voices\n")
    for lang in [x.strip() for x in a.langs.split(",") if x.strip()]:
        print(f"== {lang}  (set ANAM_VOICE_ID_{lang.upper()}=<id>)")
        found = candidates(voices, lang, a.top)
        for v in found:
            print(f"  {v['id']}  {v.get('displayName')}  [{v.get('provider')}, {v.get('gender') or '?'}]  {v.get('description') or ''}")
        if not found:
            print("  no voices list this language")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
