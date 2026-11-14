// Any-language support. The picker offers these common languages, or free text. The server accepts any code or name.
export interface World {
  code: string; // BCP-47
  en: string; // English name
  native: string;
}

export const WORLD: World[] = [
  { code: "en", en: "English", native: "English" },
  { code: "es", en: "Spanish", native: "Español" },
  { code: "fr", en: "French", native: "Français" },
  { code: "de", en: "German", native: "Deutsch" },
  { code: "it", en: "Italian", native: "Italiano" },
  { code: "pt", en: "Portuguese", native: "Português" },
  { code: "nl", en: "Dutch", native: "Nederlands" },
  { code: "pl", en: "Polish", native: "Polski" },
  { code: "ro", en: "Romanian", native: "Română" },
  { code: "bg", en: "Bulgarian", native: "Български" },
  { code: "cs", en: "Czech", native: "Čeština" },
  { code: "sk", en: "Slovak", native: "Slovenčina" },
  { code: "hu", en: "Hungarian", native: "Magyar" },
  { code: "el", en: "Greek", native: "Ελληνικά" },
  { code: "sv", en: "Swedish", native: "Svenska" },
  { code: "da", en: "Danish", native: "Dansk" },
  { code: "no", en: "Norwegian", native: "Norsk" },
  { code: "fi", en: "Finnish", native: "Suomi" },
  { code: "hr", en: "Croatian", native: "Hrvatski" },
  { code: "sr", en: "Serbian", native: "Српски" },
  { code: "sl", en: "Slovenian", native: "Slovenščina" },
  { code: "ru", en: "Russian", native: "Русский" },
  { code: "uk", en: "Ukrainian", native: "Українська" },
  { code: "lt", en: "Lithuanian", native: "Lietuvių" },
  { code: "lv", en: "Latvian", native: "Latviešu" },
  { code: "et", en: "Estonian", native: "Eesti" },
  { code: "sq", en: "Albanian", native: "Shqip" },
  { code: "tr", en: "Turkish", native: "Türkçe" },
  { code: "ar", en: "Arabic", native: "العربية" },
  { code: "ur", en: "Urdu", native: "اردو" },
  { code: "fa", en: "Persian", native: "فارسی" },
  { code: "ps", en: "Pashto", native: "پښتو" },
  { code: "ku-arab", en: "Kurdish (Sorani)", native: "کوردی" },
  { code: "he", en: "Hebrew", native: "עברית" },
  { code: "ug", en: "Uyghur", native: "ئۇيغۇرچە" },
  { code: "sd", en: "Sindhi", native: "سنڌي" },
  { code: "yi", en: "Yiddish", native: "ייִדיש" },
  { code: "dv", en: "Dhivehi", native: "ދިވެހި" },
  { code: "hi", en: "Hindi", native: "हिन्दी" },
  { code: "bn", en: "Bengali", native: "বাংলা" },
  { code: "pa", en: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "gu", en: "Gujarati", native: "ગુજરાતી" },
  { code: "mr", en: "Marathi", native: "मराठी" },
  { code: "ta", en: "Tamil", native: "தமிழ்" },
  { code: "te", en: "Telugu", native: "తెలుగు" },
  { code: "kn", en: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", en: "Malayalam", native: "മലയാളം" },
  { code: "si", en: "Sinhala", native: "සිංහල" },
  { code: "ne", en: "Nepali", native: "नेपाली" },
  { code: "zh", en: "Chinese", native: "中文" },
  { code: "ja", en: "Japanese", native: "日本語" },
  { code: "ko", en: "Korean", native: "한국어" },
  { code: "vi", en: "Vietnamese", native: "Tiếng Việt" },
  { code: "th", en: "Thai", native: "ไทย" },
  { code: "id", en: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", en: "Malay", native: "Bahasa Melayu" },
  { code: "fil", en: "Filipino", native: "Filipino" },
  { code: "km", en: "Khmer", native: "ខ្មែរ" },
  { code: "my", en: "Burmese", native: "မြန်မာ" },
  { code: "so", en: "Somali", native: "Soomaali" },
  { code: "ti", en: "Tigrinya", native: "ትግርኛ" },
  { code: "am", en: "Amharic", native: "አማርኛ" },
  { code: "om", en: "Oromo", native: "Afaan Oromoo" },
  { code: "sw", en: "Swahili", native: "Kiswahili" },
  { code: "yo", en: "Yoruba", native: "Yorùbá" },
  { code: "ig", en: "Igbo", native: "Igbo" },
  { code: "ha", en: "Hausa", native: "Hausa" },
  { code: "zu", en: "Zulu", native: "isiZulu" },
  { code: "af", en: "Afrikaans", native: "Afrikaans" },
  { code: "cy", en: "Welsh", native: "Cymraeg" },
  { code: "ga", en: "Irish", native: "Gaeilge" },
  { code: "ka", en: "Georgian", native: "ქართული" },
  { code: "hy", en: "Armenian", native: "Հայերեն" },
  { code: "az", en: "Azerbaijani", native: "Azərbaycan" },
  { code: "kk", en: "Kazakh", native: "Қазақша" },
  { code: "uz", en: "Uzbek", native: "Oʻzbek" },
  { code: "mn", en: "Mongolian", native: "Монгол" },
];

export const RTL_CODES = new Set(["ar", "ur", "fa", "ps", "he", "ug", "sd", "yi", "dv", "ku-arab"]);

const norm = (s: string) => s.normalize("NFC").trim().toLowerCase();

/** Same cleaning as the server: letters (any script), marks, hyphens and spaces, max 40 characters. */
export function cleanLanguage(raw: string): string {
  const s = raw.normalize("NFC").replace(/[^\p{L}\p{M}\- ]/gu, "").replace(/\s+/g, " ").replace(/^[ -]+|[ -]+$/g, "");
  return s.slice(0, 40).replace(/[ -]+$/, "");
}

export function findWorld(lang: string): World | undefined {
  const q = norm(lang);
  return (
    WORLD.find((w) => w.code === q || norm(w.en) === q || norm(w.native) === q) ??
    WORLD.find((w) => w.code === q.split("-")[0])
  );
}

/** Label to show for a language code or free-text name. */
export function languageLabel(lang: string): string {
  const w = findWorld(lang);
  return w ? w.native : lang;
}

export function isRtl(lang: string): boolean {
  const w = findWorld(lang);
  return !!w && RTL_CODES.has(w.code);
}

/** Value to store and send: the BCP-47 code when we know the language, else the cleaned free text. */
export function languageValue(input: string): string {
  const w = WORLD.find((x) => norm(x.en) === norm(input) || norm(x.native) === norm(input) || x.code === norm(input));
  return w ? w.code : cleanLanguage(input);
}

export function searchLanguages(q: string): World[] {
  const n = norm(q);
  if (!n) return WORLD;
  return WORLD.filter((w) => norm(w.en).includes(n) || norm(w.native).includes(n) || w.code.startsWith(n));
}

// Languages ElevenLabs eleven_multilingual_v2 speaks (mirror of agent/langs.py).
const TTS = new Set(["en", "ja", "zh", "de", "hi", "fr", "ko", "pt", "it", "es", "ru", "id", "nl", "tr", "fil", "pl", "sv", "bg", "ro", "ar", "cs", "el", "fi", "hr", "ms", "sk", "da", "ta", "uk"]);
const serverUnsupported = new Set<string>();

export function markVoiceUnsupported(lang: string) {
  serverUnsupported.add(lang);
}

/** True when a voice exists for this language: the server voice, or a matching voice in the browser. */
export function canSpeak(lang: string): boolean {
  if (serverUnsupported.has(lang) && !browserHasVoice(lang)) return false;
  const w = findWorld(lang);
  if (w && w.code !== "ku-arab" && TTS.has(w.code)) return true;
  return browserHasVoice(lang);
}

function browserHasVoice(lang: string): boolean {
  const w = findWorld(lang);
  const code = (w?.code ?? lang).toLowerCase();
  if (!("speechSynthesis" in window)) return false;
  return window.speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().split(/[-_]/)[0] === code.split("-")[0]);
}
