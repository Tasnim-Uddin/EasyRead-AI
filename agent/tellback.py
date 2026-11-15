"""Spoken 'tell me back' lines for the check_understanding tool, in the guide language.

Fixed text only (the same languages as the web quiz in web/src/i18n.ts). The facts (dose, frequency) come from the
guide itself, so nothing is invented. The app names no person of its own (no pharmacist, no GP): who to check with
is the paper's sender when the guide has one ({who}), else a plain "whoever gave it to you" (the *_any lines).
Any other language is translated by the model when one is available, else English."""
from . import langs, llm

# Keys: ask_inhaler, ask_other, conflict_ask, ok, conflict_ok / conflict_bad / nearly (with {who}) and their *_any
# versions (no sender), nearly* take {line} (the dose and when). "accept": lower-case word parts that show the user
# would check with someone first (ask, check, pharmacist...), used to accept a conflict answer.
TABLE = {
    "en": {
        "ask_inhaler": "Can you tell me in your own words how many puffs, and when you use it?",
        "ask_other": "Can you tell me in your own words how much to take, and when?",
        "conflict_ask": "Your label and leaflet say different things. What do you do?",
        "ok": "Well done, that is right.",
        "conflict_ok": "Well done, that is right. Check with {who} before you use it.",
        "conflict_ok_any": "Well done, that is right. Check with whoever gave it to you before you use it.",
        "conflict_bad": "Nearly. Your label and leaflet say different things. Check with {who} before you use it.",
        "conflict_bad_any": "Nearly. Your label and leaflet say different things. Check with whoever gave it to you before you use it.",
        "nearly": "Nearly. Remember: {line}. If you are not sure, check with {who}.",
        "nearly_any": "Nearly. Remember: {line}. If you are not sure, check with whoever gave it to you.",
        "accept": ["ask", "check", "pharmac", "whoever", "sender"],
    },
    "es": {
        "ask_inhaler": "¿Puede decirme con sus palabras cuántas inhalaciones y cuándo lo usa?",
        "ask_other": "¿Puede decirme con sus palabras cuánto tiene que tomar y cuándo?",
        "conflict_ask": "Su etiqueta y su prospecto dicen cosas distintas. ¿Qué hace?",
        "ok": "Muy bien, es correcto.",
        "conflict_ok": "Muy bien, es correcto. Consulte con {who} antes de usarlo.",
        "conflict_ok_any": "Muy bien, es correcto. Consulte con quien se lo dio antes de usarlo.",
        "conflict_bad": "Casi. Su etiqueta y su prospecto dicen cosas distintas. Consulte con {who} antes de usarlo.",
        "conflict_bad_any": "Casi. Su etiqueta y su prospecto dicen cosas distintas. Consulte con quien se lo dio antes de usarlo.",
        "nearly": "Casi. Recuerde: {line}. Si tiene dudas, consulte con {who}.",
        "nearly_any": "Casi. Recuerde: {line}. Si tiene dudas, consulte con quien se lo dio.",
        "accept": ["pregunt", "consult", "comprob", "farmac"],
    },
    "ar": {
        "ask_inhaler": "هل يمكنك أن تخبرني بكلماتك كم بخة تستعمل ومتى؟",
        "ask_other": "هل يمكنك أن تخبرني بكلماتك كم تأخذ ومتى؟",
        "conflict_ask": "الملصق والنشرة يقولان أشياء مختلفة. ماذا تفعل؟",
        "ok": "أحسنت، هذا صحيح.",
        "conflict_ok": "أحسنت، هذا صحيح. تحقّق مع {who} قبل أن تستعمله.",
        "conflict_ok_any": "أحسنت، هذا صحيح. تحقّق مع من أعطاك إياه قبل أن تستعمله.",
        "conflict_bad": "تقريبًا. الملصق والنشرة يقولان أشياء مختلفة. تحقّق مع {who} قبل أن تستعمله.",
        "conflict_bad_any": "تقريبًا. الملصق والنشرة يقولان أشياء مختلفة. تحقّق مع من أعطاك إياه قبل أن تستعمله.",
        "nearly": "تقريبًا. تذكّر: {line}. إذا لم تكن متأكدًا، تحقّق مع {who}.",
        "nearly_any": "تقريبًا. تذكّر: {line}. إذا لم تكن متأكدًا، تحقّق مع من أعطاك إياه.",
        "accept": ["سأل", "سال", "تحقق", "تحقّق", "صيدل"],
    },
    "pl": {
        "ask_inhaler": "Czy możesz własnymi słowami powiedzieć, ile razy psikasz i kiedy?",
        "ask_other": "Czy możesz własnymi słowami powiedzieć, ile brać i kiedy?",
        "conflict_ask": "Etykieta i ulotka mówią co innego. Co robisz?",
        "ok": "Dobrze, to prawda.",
        "conflict_ok": "Dobrze, to prawda. Zanim użyjesz, zapytaj {who}.",
        "conflict_ok_any": "Dobrze, to prawda. Zanim użyjesz, zapytaj osobę, która ci to dała.",
        "conflict_bad": "Prawie. Etykieta i ulotka mówią co innego. Zanim użyjesz, zapytaj {who}.",
        "conflict_bad_any": "Prawie. Etykieta i ulotka mówią co innego. Zanim użyjesz, zapytaj osobę, która ci to dała.",
        "nearly": "Prawie. Pamiętaj: {line}. Jeśli nie masz pewności, zapytaj {who}.",
        "nearly_any": "Prawie. Pamiętaj: {line}. Jeśli nie masz pewności, zapytaj osobę, która ci to dała.",
        "accept": ["pyta", "sprawdz", "sprawdź", "farmaceu", "aptek", "nadawc"],
    },
    "bn": {
        "ask_inhaler": "আপনি কি নিজের কথায় বলতে পারেন কতবার পাফ নেন আর কখন?",
        "ask_other": "আপনি কি নিজের কথায় বলতে পারেন কতটা নেবেন আর কখন?",
        "conflict_ask": "লেবেল আর লিফলেট আলাদা কথা বলছে। আপনি কী করবেন?",
        "ok": "ঠিক বলেছেন।",
        "conflict_ok": "ঠিক বলেছেন। ব্যবহারের আগে {who}-কে জিজ্ঞেস করুন।",
        "conflict_ok_any": "ঠিক বলেছেন। ব্যবহারের আগে যিনি এটি আপনাকে দিয়েছেন তাঁকে জিজ্ঞেস করুন।",
        "conflict_bad": "প্রায় ঠিক। লেবেল আর লিফলেট আলাদা কথা বলছে। ব্যবহারের আগে {who}-কে জিজ্ঞেস করুন।",
        "conflict_bad_any": "প্রায় ঠিক। লেবেল আর লিফলেট আলাদা কথা বলছে। ব্যবহারের আগে যিনি এটি আপনাকে দিয়েছেন তাঁকে জিজ্ঞেস করুন।",
        "nearly": "প্রায় ঠিক। মনে রাখবেন: {line}। নিশ্চিত না হলে {who}-কে জিজ্ঞেস করুন।",
        "nearly_any": "প্রায় ঠিক। মনে রাখবেন: {line}। নিশ্চিত না হলে যিনি এটি আপনাকে দিয়েছেন তাঁকে জিজ্ঞেস করুন।",
        "accept": ["জিজ্ঞেস", "জিজ্ঞাসা", "যাচাই", "ফার্মাসিস্ট", "ফার্মেসি"],
    },
    "ur": {
        "ask_inhaler": "کیا آپ اپنے الفاظ میں بتا سکتے ہیں کہ کتنے پف لیتے ہیں اور کب؟",
        "ask_other": "کیا آپ اپنے الفاظ میں بتا سکتے ہیں کہ کتنی لینی ہے اور کب؟",
        "conflict_ask": "لیبل اور پرچہ الگ باتیں کہتے ہیں۔ آپ کیا کریں گے؟",
        "ok": "شاباش، یہ درست ہے۔",
        "conflict_ok": "شاباش، یہ درست ہے۔ استعمال سے پہلے {who} سے پوچھیں۔",
        "conflict_ok_any": "شاباش، یہ درست ہے۔ استعمال سے پہلے اس سے پوچھیں جس نے یہ آپ کو دیا۔",
        "conflict_bad": "تقریباً۔ لیبل اور پرچہ الگ باتیں کہتے ہیں۔ استعمال سے پہلے {who} سے پوچھیں۔",
        "conflict_bad_any": "تقریباً۔ لیبل اور پرچہ الگ باتیں کہتے ہیں۔ استعمال سے پہلے اس سے پوچھیں جس نے یہ آپ کو دیا۔",
        "nearly": "تقریباً۔ یاد رکھیں: {line}۔ یقین نہ ہو تو {who} سے پوچھیں۔",
        "nearly_any": "تقریباً۔ یاد رکھیں: {line}۔ یقین نہ ہو تو اس سے پوچھیں جس نے یہ آپ کو دیا۔",
        "accept": ["پوچھ", "فارماسسٹ", "دوا ساز"],
    },
    "fr": {
        "ask_inhaler": "Pouvez-vous me dire avec vos mots combien de bouffées vous prenez, et quand ?",
        "ask_other": "Pouvez-vous me dire avec vos mots combien en prendre, et quand ?",
        "conflict_ask": "Votre étiquette et votre notice disent des choses différentes. Que faites-vous ?",
        "ok": "Bien, c'est juste.",
        "conflict_ok": "Bien, c'est juste. Avant de l'utiliser, demandez à {who}.",
        "conflict_ok_any": "Bien, c'est juste. Avant de l'utiliser, demandez à la personne qui vous l'a donné.",
        "conflict_bad": "Presque. Votre étiquette et votre notice disent des choses différentes. Avant de l'utiliser, demandez à {who}.",
        "conflict_bad_any": "Presque. Votre étiquette et votre notice disent des choses différentes. Avant de l'utiliser, demandez à la personne qui vous l'a donné.",
        "nearly": "Presque. Rappel : {line}. En cas de doute, demandez à {who}.",
        "nearly_any": "Presque. Rappel : {line}. En cas de doute, demandez à la personne qui vous l'a donné.",
        "accept": ["demand", "vérifi", "verifi", "pharmac"],
    },
    "hi": {
        "ask_inhaler": "क्या आप अपने शब्दों में बता सकते हैं कि कितने पफ लेते हैं और कब?",
        "ask_other": "क्या आप अपने शब्दों में बता सकते हैं कि कितनी लेनी है और कब?",
        "conflict_ask": "लेबल और पर्चा अलग-अलग बातें कहते हैं। आप क्या करेंगे?",
        "ok": "बहुत अच्छे, यह सही है।",
        "conflict_ok": "बहुत अच्छे, यह सही है। इस्तेमाल से पहले {who} से पूछें।",
        "conflict_ok_any": "बहुत अच्छे, यह सही है। इस्तेमाल से पहले उनसे पूछें जिन्होंने यह आपको दिया।",
        "conflict_bad": "लगभग। लेबल और पर्चा अलग-अलग बातें कहते हैं। इस्तेमाल से पहले {who} से पूछें।",
        "conflict_bad_any": "लगभग। लेबल और पर्चा अलग-अलग बातें कहते हैं। इस्तेमाल से पहले उनसे पूछें जिन्होंने यह आपको दिया।",
        "nearly": "लगभग। याद रखें: {line}। पक्का न हो तो {who} से पूछें।",
        "nearly_any": "लगभग। याद रखें: {line}। पक्का न हो तो उनसे पूछें जिन्होंने यह आपको दिया।",
        "accept": ["पूछ", "जाँच", "जांच", "फार्मासिस्ट", "फार्मेसी"],
    },
    "pt": {
        "ask_inhaler": "Pode dizer-me, com as suas palavras, quantas inalações faz e quando?",
        "ask_other": "Pode dizer-me, com as suas palavras, quanto deve tomar e quando?",
        "conflict_ask": "O rótulo e o folheto dizem coisas diferentes. O que faz?",
        "ok": "Muito bem, está certo.",
        "conflict_ok": "Muito bem, está certo. Antes de usar, pergunte a {who}.",
        "conflict_ok_any": "Muito bem, está certo. Antes de usar, pergunte a quem lho deu.",
        "conflict_bad": "Quase. O rótulo e o folheto dizem coisas diferentes. Antes de usar, pergunte a {who}.",
        "conflict_bad_any": "Quase. O rótulo e o folheto dizem coisas diferentes. Antes de usar, pergunte a quem lho deu.",
        "nearly": "Quase. Lembre-se: {line}. Se tiver dúvidas, pergunte a {who}.",
        "nearly_any": "Quase. Lembre-se: {line}. Se tiver dúvidas, pergunte a quem lho deu.",
        "accept": ["pergunt", "verific", "confirm", "farmac"],
    },
    "zh": {
        "ask_inhaler": "你能用自己的话告诉我，每次吸几下，什么时候用吗？",
        "ask_other": "你能用自己的话告诉我，每次吃多少，什么时候吃吗？",
        "conflict_ask": "标签和说明书说的不一样。你会怎么做？",
        "ok": "很好，答对了。",
        "conflict_ok": "很好，答对了。使用前，请先问{who}。",
        "conflict_ok_any": "很好，答对了。使用前，请先问给你这个的人。",
        "conflict_bad": "差一点。标签和说明书说的不一样。使用前，请先问{who}。",
        "conflict_bad_any": "差一点。标签和说明书说的不一样。使用前，请先问给你这个的人。",
        "nearly": "差一点。请记住：{line}。不确定的话，请问{who}。",
        "nearly_any": "差一点。请记住：{line}。不确定的话，请问给你这个的人。",
        "accept": ["问", "查", "确认", "药剂师", "药师"],
    },
}


def code(language: str) -> str:
    return (langs.code_of(language) or "en").split("-")[0]


def strings(language: str) -> dict:
    """The table for a guide language (code or name); English when we have no table for it."""
    return TABLE.get(code(language), TABLE["en"])


def line(language: str, key: str, who: str | None = None, **values) -> str:
    """A verdict line: the {who} version when the paper names who to ask, else the plain *_any version."""
    t = strings(language)
    if who and key + "_any" in t:
        return t[key].format(who=who, **values)
    return t.get(key + "_any", t[key]).format(**values)


def mentions_who_to_ask(language: str, answer: str, who: str | None = None) -> bool:
    """True when the reply says the user would ask or check first (in their language or English), or names the sender."""
    low = (answer or "").lower()
    words = set(strings(language)["accept"]) | set(TABLE["en"]["accept"])
    if who:
        words.add(who.lower())
    return any(w and w in low for w in words)


def mentions_pharmacist(language: str, answer: str) -> bool:
    """Older name for mentions_who_to_ask."""
    return mentions_who_to_ask(language, answer)


async def localise(text: str, language: str) -> str:
    """A tell-back line in a guide language with no fixed table: the model translates it; English if it cannot."""
    if langs.code_of(language) in TABLE or not llm.available():
        return text
    try:
        out = (await llm.complete(f"Translate into {langs.name_of(language)}. Keep names and numbers as they are. "
                                  "Reply with the translation only.", text, 200)).strip()
        return out or text
    except Exception:
        return text
