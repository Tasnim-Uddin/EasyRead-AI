"""Spoken 'tell me back' lines for the check_understanding tool, in the guide language.

Fixed text only (the same languages as the web quiz in web/src/i18n.ts). The facts (dose, frequency) come from the
guide itself, so nothing is invented. Any other language falls back to English."""
from . import langs

# Keys: ask_inhaler, ask_other, conflict_ask, conflict_ok, conflict_bad, ok, nearly ({dose}, {frequency}), pharm (words that
# mean "pharmacist" in that language, lower-case, used to accept a conflict answer).
TABLE = {
    "en": {
        "ask_inhaler": "Can you tell me in your own words how many puffs, and when you use it?",
        "ask_other": "Can you tell me in your own words how much to take, and when?",
        "conflict_ask": "Your label and leaflet say different things. What do you do?",
        "conflict_ok": "Well done, that is right. Ask your pharmacist before you use it.",
        "conflict_bad": "Nearly. Ask your pharmacist before you use it, because your label and leaflet say different things.",
        "ok": "Well done, that is right.",
        "nearly": "Nearly. Remember: {dose}, {frequency}. Please ask your pharmacist if unsure.",
        "pharm": ["pharmacist"],
    },
    "es": {
        "ask_inhaler": "¿Puede decirme con sus palabras cuántas inhalaciones y cuándo lo usa?",
        "ask_other": "¿Puede decirme con sus palabras cuánto tiene que tomar y cuándo?",
        "conflict_ask": "Su etiqueta y su prospecto dicen cosas distintas. ¿Qué hace?",
        "conflict_ok": "Muy bien, es correcto. Pregunte a su farmacéutico antes de usarlo.",
        "conflict_bad": "Casi. Pregunte a su farmacéutico antes de usarlo, porque su etiqueta y su prospecto dicen cosas distintas.",
        "ok": "Muy bien, es correcto.",
        "nearly": "Casi. Recuerde: {dose}, {frequency}. Si tiene dudas, pregunte a su farmacéutico.",
        "pharm": ["farmac"],
    },
    "ar": {
        "ask_inhaler": "هل يمكنك أن تخبرني بكلماتك كم بخة تستعمل ومتى؟",
        "ask_other": "هل يمكنك أن تخبرني بكلماتك كم تأخذ ومتى؟",
        "conflict_ask": "الملصق والنشرة يقولان أشياء مختلفة. ماذا تفعل؟",
        "conflict_ok": "أحسنت، هذا صحيح. اسأل الصيدلي قبل أن تستعمله.",
        "conflict_bad": "تقريبا. اسأل الصيدلي قبل أن تستعمله، لأن الملصق والنشرة يقولان أشياء مختلفة.",
        "ok": "أحسنت، هذا صحيح.",
        "nearly": "تقريبا. تذكر: {dose}، {frequency}. اسأل الصيدلي إذا لم تكن متأكدا.",
        "pharm": ["صيدل"],
    },
    "pl": {
        "ask_inhaler": "Czy możesz własnymi słowami powiedzieć, ile razy psikasz i kiedy?",
        "ask_other": "Czy możesz własnymi słowami powiedzieć, ile brać i kiedy?",
        "conflict_ask": "Etykieta i ulotka mówią co innego. Co robisz?",
        "conflict_ok": "Dobrze, to prawda. Zapytaj farmaceutę, zanim użyjesz.",
        "conflict_bad": "Prawie. Zapytaj farmaceutę, zanim użyjesz, bo etykieta i ulotka mówią co innego.",
        "ok": "Dobrze, to prawda.",
        "nearly": "Prawie. Pamiętaj: {dose}, {frequency}. Jeśli nie masz pewności, zapytaj farmaceutę.",
        "pharm": ["farmaceu", "apteka"],
    },
    "bn": {
        "ask_inhaler": "আপনি কি নিজের কথায় বলতে পারেন কতবার পাফ নেন আর কখন?",
        "ask_other": "আপনি কি নিজের কথায় বলতে পারেন কতটা নেবেন আর কখন?",
        "conflict_ask": "লেবেল আর লিফলেট আলাদা কথা বলছে। আপনি কী করবেন?",
        "conflict_ok": "ঠিক বলেছেন। ব্যবহারের আগে ফার্মাসিস্টকে জিজ্ঞেস করুন।",
        "conflict_bad": "প্রায় ঠিক। ব্যবহারের আগে ফার্মাসিস্টকে জিজ্ঞেস করুন, কারণ লেবেল আর লিফলেট আলাদা কথা বলছে।",
        "ok": "ঠিক বলেছেন।",
        "nearly": "প্রায় ঠিক। মনে রাখবেন: {dose}, {frequency}। নিশ্চিত না হলে ফার্মাসিস্টকে জিজ্ঞেস করুন।",
        "pharm": ["ফার্মাসিস্ট", "ফার্মাসী"],
    },
    "ur": {
        "ask_inhaler": "کیا آپ اپنے الفاظ میں بتا سکتے ہیں کہ کتنے پف لیتے ہیں اور کب؟",
        "ask_other": "کیا آپ اپنے الفاظ میں بتا سکتے ہیں کہ کتنی لینی ہے اور کب؟",
        "conflict_ask": "لیبل اور پرچہ الگ باتیں کہتے ہیں۔ آپ کیا کریں گے؟",
        "conflict_ok": "شاباش، یہ درست ہے۔ استعمال سے پہلے فارماسسٹ سے پوچھیں۔",
        "conflict_bad": "تقریباً۔ استعمال سے پہلے فارماسسٹ سے پوچھیں، کیونکہ لیبل اور پرچہ الگ باتیں کہتے ہیں۔",
        "ok": "شاباش، یہ درست ہے۔",
        "nearly": "تقریباً۔ یاد رکھیں: {dose}، {frequency}۔ یقین نہ ہو تو فارماسسٹ سے پوچھیں۔",
        "pharm": ["فارماسسٹ", "دوا ساز"],
    },
    "fr": {
        "ask_inhaler": "Pouvez-vous me dire avec vos mots combien de bouffées vous prenez, et quand ?",
        "ask_other": "Pouvez-vous me dire avec vos mots combien en prendre, et quand ?",
        "conflict_ask": "Votre étiquette et votre notice disent des choses différentes. Que faites-vous ?",
        "conflict_ok": "Bien, c'est juste. Demandez à votre pharmacien avant de l'utiliser.",
        "conflict_bad": "Presque. Demandez à votre pharmacien avant de l'utiliser, car votre étiquette et votre notice disent des choses différentes.",
        "ok": "Bien, c'est juste.",
        "nearly": "Presque. Rappel : {dose}, {frequency}. En cas de doute, demandez à votre pharmacien.",
        "pharm": ["pharmacien", "pharmacie"],
    },
    "hi": {
        "ask_inhaler": "क्या आप अपने शब्दों में बता सकते हैं कि कितने पफ लेते हैं और कब?",
        "ask_other": "क्या आप अपने शब्दों में बता सकते हैं कि कितनी लेनी है और कब?",
        "conflict_ask": "लेबल और पर्चा अलग-अलग बातें कहते हैं। आप क्या करेंगे?",
        "conflict_ok": "बहुत अच्छे, यह सही है। इस्तेमाल से पहले फार्मासिस्ट से पूछें।",
        "conflict_bad": "लगभग। इस्तेमाल से पहले फार्मासिस्ट से पूछें, क्योंकि लेबल और पर्चा अलग-अलग बातें कहते हैं।",
        "ok": "बहुत अच्छे, यह सही है।",
        "nearly": "लगभग। याद रखें: {dose}, {frequency}। पक्का न हो तो फार्मासिस्ट से पूछें।",
        "pharm": ["फार्मासिस्ट", "फार्मेसी", "दवा विक्रेता"],
    },
    "pt": {
        "ask_inhaler": "Pode dizer-me, com as suas palavras, quantas inalações faz e quando?",
        "ask_other": "Pode dizer-me, com as suas palavras, quanto deve tomar e quando?",
        "conflict_ask": "O rótulo e o folheto dizem coisas diferentes. O que faz?",
        "conflict_ok": "Muito bem, está certo. Pergunte ao seu farmacêutico antes de usar.",
        "conflict_bad": "Quase. Pergunte ao seu farmacêutico antes de usar, porque o rótulo e o folheto dizem coisas diferentes.",
        "ok": "Muito bem, está certo.",
        "nearly": "Quase. Lembre-se: {dose}, {frequency}. Se tiver dúvidas, pergunte ao seu farmacêutico.",
        "pharm": ["farmac"],
    },
    "zh": {
        "ask_inhaler": "你能用自己的话告诉我，每次吸几下，什么时候用吗？",
        "ask_other": "你能用自己的话告诉我，每次吃多少，什么时候吃吗？",
        "conflict_ask": "标签和说明书说的不一样。你会怎么做？",
        "conflict_ok": "很好，答对了。使用前请先问药剂师。",
        "conflict_bad": "差一点。使用前请先问药剂师，因为标签和说明书说的不一样。",
        "ok": "很好，答对了。",
        "nearly": "差一点。请记住：{dose}，{frequency}。不确定的话，请问药剂师。",
        "pharm": ["药剂师", "药师"],
    },
}


def strings(language: str) -> dict:
    """The table for a guide language (code or name); English when we have no table for it."""
    code = (langs.code_of(language) or "en").split("-")[0]
    return TABLE.get(code, TABLE["en"])


def mentions_pharmacist(language: str, answer: str) -> bool:
    low = (answer or "").lower()
    words = set(strings(language)["pharm"]) | set(TABLE["en"]["pharm"])
    return any(w in low for w in words)
