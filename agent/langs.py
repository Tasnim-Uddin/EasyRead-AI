"""Any-language support: sanitise a user-chosen language, resolve it to a code and a readable name.

The language reaches model prompts, so it is cut down to letters, hyphens and spaces (max 40 characters)."""
import re, unicodedata

MAX_LEN = 40

# BCP-47 base code -> English name. Covers the languages the web picker offers; anything else is passed on as free text.
NAMES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German", "it": "Italian", "pt": "Portuguese", "nl": "Dutch",
    "pl": "Polish", "ro": "Romanian", "bg": "Bulgarian", "cs": "Czech", "sk": "Slovak", "hu": "Hungarian", "el": "Greek",
    "sv": "Swedish", "da": "Danish", "no": "Norwegian", "fi": "Finnish", "hr": "Croatian", "sr": "Serbian", "sl": "Slovenian",
    "ru": "Russian", "uk": "Ukrainian", "lt": "Lithuanian", "lv": "Latvian", "et": "Estonian", "sq": "Albanian",
    "tr": "Turkish", "ar": "Arabic", "ur": "Urdu", "fa": "Persian", "ps": "Pashto", "he": "Hebrew", "ku": "Kurdish",
    "hi": "Hindi", "bn": "Bengali", "pa": "Punjabi", "gu": "Gujarati", "mr": "Marathi", "ta": "Tamil", "te": "Telugu",
    "kn": "Kannada", "ml": "Malayalam", "si": "Sinhala", "ne": "Nepali", "zh": "Chinese", "ja": "Japanese", "ko": "Korean",
    "vi": "Vietnamese", "th": "Thai", "id": "Indonesian", "ms": "Malay", "fil": "Filipino", "km": "Khmer", "my": "Burmese",
    "so": "Somali", "ti": "Tigrinya", "am": "Amharic", "om": "Oromo", "sw": "Swahili", "yo": "Yoruba", "ig": "Igbo",
    "ha": "Hausa", "zu": "Zulu", "xh": "Xhosa", "af": "Afrikaans", "ak": "Akan", "sn": "Shona", "rw": "Kinyarwanda",
    "ug": "Uyghur", "sd": "Sindhi", "yi": "Yiddish", "dv": "Dhivehi", "cy": "Welsh", "ga": "Irish", "gd": "Scottish Gaelic",
    "ka": "Georgian", "hy": "Armenian", "az": "Azerbaijani", "kk": "Kazakh", "uz": "Uzbek", "mn": "Mongolian",
    "ku-arab": "Kurdish (Sorani)",
}
_BY_NAME = {v.lower(): k for k, v in NAMES.items()}
_BY_NAME.update({"farsi": "fa", "tagalog": "fil", "panjabi": "pa", "mandarin": "zh", "cantonese": "zh", "sorani": "ku-arab"})

RTL = {"ar", "ur", "fa", "ps", "he", "ug", "sd", "yi", "dv", "ku-arab"}

# Languages ElevenLabs eleven_multilingual_v2 speaks (base codes).
TTS_LANGS = {"en", "ja", "zh", "de", "hi", "fr", "ko", "pt", "it", "es", "ru", "id", "nl", "tr", "fil", "pl", "sv", "bg",
             "ro", "ar", "cs", "el", "fi", "hr", "ms", "sk", "da", "ta", "uk"}


def clean(raw) -> str:
    """Letters (any script), combining marks, hyphens and spaces only; max 40 chars; empty -> 'en'."""
    s = unicodedata.normalize("NFC", str(raw or ""))
    s = "".join(ch for ch in s if ch.isalpha() or ch in "- " or unicodedata.category(ch).startswith("M"))
    s = re.sub(r"\s+", " ", s).strip(" -")
    return s[:MAX_LEN].strip(" -") or "en"


def code_of(lang: str) -> str | None:
    """Known BCP-47 code for a language (a code like 'es-MX' or a name like 'Somali'), else None."""
    low = clean(lang).lower()
    if low in NAMES:
        return low
    if low in _BY_NAME:
        return _BY_NAME[low]
    base = low.split("-")[0]
    return base if base in NAMES else None


def name_of(lang: str) -> str:
    """Human-readable language name for prompts: 'es' -> 'Spanish'; unknown free text stays as typed."""
    lang = clean(lang)
    c = code_of(lang)
    return NAMES[c] if c else lang


def is_rtl(lang: str) -> bool:
    c = code_of(lang)
    return bool(c) and c in RTL


def tts_supported(lang: str) -> bool:
    c = code_of(lang)
    return bool(c) and c.split("-")[0] in TTS_LANGS and c != "ku-arab"
