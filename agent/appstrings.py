"""Sentences the app itself adds to a guide (not copied from the paper), with fixed text in the 6 UI languages.

The app never adds advice or a person of its own: who to ask comes from the paper's sender, else a plain "whoever
sent it". The pipeline uses `fixed()` before the model translation, so these lines are right in es/ar/ur/pl/bn even
when the model is slow or missing; any other guide language goes through the model like the rest of the steps."""
import re
from . import langs

UI_LANGS = ("en", "es", "ar", "ur", "pl", "bn")

# Label and leaflet disagree (medicine). "Whoever gave it to you": the app never names a pharmacist or a GP.
CONFLICT = {
    "en": "Your label and leaflet say different things. Check with whoever gave it to you.",
    "es": "Su etiqueta y su prospecto dicen cosas distintas. Consulte con quien se lo dio.",
    "ar": "الملصق والنشرة يقولان أشياء مختلفة. تحقّق مع من أعطاك إياه.",
    "ur": "لیبل اور پرچہ الگ باتیں کہتے ہیں۔ جس نے یہ آپ کو دیا اس سے پوچھیں۔",
    "pl": "Etykieta i ulotka mówią co innego. Zapytaj osobę, która ci to dała.",
    "bn": "লেবেল আর লিফলেট আলাদা কথা বলছে। যিনি এটি আপনাকে দিয়েছেন তাঁকে জিজ্ঞেস করুন।",
}
# Two papers (not a label and leaflet) disagree.
PAPERS_DIFFER = {
    "en": "Your papers say different things. Check which one is right before you act.",
    "es": "Sus papeles dicen cosas distintas. Compruebe cuál es el correcto antes de actuar.",
    "ar": "أوراقك تقول أشياء مختلفة. تحقّق أيّها الصحيح قبل أن تتصرّف.",
    "ur": "آپ کے کاغذ الگ الگ باتیں کہتے ہیں۔ کچھ کرنے سے پہلے دیکھیں کہ کون سا درست ہے۔",
    "pl": "Twoje dokumenty mówią co innego. Zanim coś zrobisz, sprawdź, który jest właściwy.",
    "bn": "আপনার কাগজগুলো আলাদা কথা বলছে। কিছু করার আগে দেখুন কোনটি ঠিক।",
}
# The date on the paper is blank: with the sender's name ({who}), or the plain version.
NO_DATE = {
    "en": "Your paper does not show the date. Check with {who}.",
    "es": "Su papel no muestra la fecha. Consulte con {who}.",
    "ar": "ورقتك لا تُظهر التاريخ. تحقّق مع {who}.",
    "ur": "آپ کے کاغذ پر تاریخ نہیں ہے۔ {who} سے پوچھیں۔",
    "pl": "Na Twoim dokumencie nie ma daty. Zapytaj: {who}.",
    "bn": "আপনার কাগজে তারিখ নেই। {who}-কে জিজ্ঞেস করুন।",
}
NO_DATE_ANY = {
    "en": "Your paper does not show the date. Check with whoever sent it.",
    "es": "Su papel no muestra la fecha. Consulte con quien se lo envió.",
    "ar": "ورقتك لا تُظهر التاريخ. تحقّق مع الجهة التي أرسلتها.",
    "ur": "آپ کے کاغذ پر تاریخ نہیں ہے۔ جس نے یہ بھیجا اس سے پوچھیں۔",
    "pl": "Na Twoim dokumencie nie ma daty. Zapytaj nadawcę pisma.",
    "bn": "আপনার কাগজে তারিখ নেই। যিনি এটি পাঠিয়েছেন তাঁকে জিজ্ঞেস করুন।",
}
NO_AMOUNT = {
    "en": "Your paper does not show the amount.",
    "es": "Su papel no muestra la cantidad.",
    "ar": "ورقتك لا تُظهر المبلغ.",
    "ur": "آپ کے کاغذ پر رقم نہیں لکھی۔",
    "pl": "Na Twoim dokumencie nie ma kwoty.",
    "bn": "আপনার কাগজে টাকার পরিমাণ নেই।",
}
# Error messages stored on a failed guide (the web shows its own translated text by error_code; these are for
# anything that reads guide.error directly, e.g. the avatar).
NOT_A_DOCUMENT = {
    "en": "This is not a photo of a paper. Try another.",
    "es": "Esto no es una foto de un papel. Pruebe con otra.",
    "ar": "هذه ليست صورة لورقة. جرّب صورة أخرى.",
    "ur": "یہ کسی کاغذ کی تصویر نہیں۔ دوسری آزمائیں۔",
    "pl": "To nie jest zdjęcie dokumentu. Spróbuj innego.",
    "bn": "এটি কোনো কাগজের ছবি নয়। অন্যটি চেষ্টা করুন।",
}
UNREADABLE = {
    "en": "We could not read this photo. Take a clearer photo in good light.",
    "es": "No pudimos leer esta foto. Haga una foto más clara, con buena luz.",
    "ar": "لم نتمكن من قراءة هذه الصورة. التقط صورة أوضح في ضوء جيد.",
    "ur": "ہم یہ تصویر نہیں پڑھ سکے۔ اچھی روشنی میں زیادہ صاف تصویر لیں۔",
    "pl": "Nie mogliśmy odczytać tego zdjęcia. Zrób wyraźniejsze zdjęcie w dobrym świetle.",
    "bn": "আমরা এই ছবিটি পড়তে পারিনি। ভালো আলোতে আরও পরিষ্কার ছবি তুলুন।",
}

GENERIC_WHO_EN = "whoever sent it"


def code(language: str) -> str:
    """'es', 'Spanish', 'es-MX' -> 'es'; unknown -> the cleaned value."""
    return (langs.code_of(language) or language or "en").split("-")[0].lower()


def pick(table: dict, language: str) -> str:
    """The line in this language, English when the language has no fixed text."""
    return table.get(code(language), table["en"])


def no_date_en(who: str | None) -> str:
    who = (who or "").strip()
    return NO_DATE["en"].format(who=who) if who and who != GENERIC_WHO_EN else NO_DATE_ANY["en"]


_NO_DATE_RE = re.compile(r"^" + re.escape(NO_DATE["en"]).replace(re.escape("{who}"), "(?P<who>.+)") + r"$")


def fixed(text_en: str, language: str) -> str | None:
    """The fixed translation of an app-added English sentence, or None (paper text: the model translates it)."""
    c = code(language)
    if c not in UI_LANGS:
        return None
    t = (text_en or "").strip()
    for table in (CONFLICT, PAPERS_DIFFER, NO_DATE_ANY, NO_AMOUNT, NOT_A_DOCUMENT, UNREADABLE):
        if t == table["en"]:
            return table[c]
    m = _NO_DATE_RE.match(t)
    if m:
        # The sender's name is a name: it stays as printed on the paper.
        return NO_DATE[c].format(who=m.group("who"))
    return None
