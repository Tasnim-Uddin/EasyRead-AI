// UI captions. Step text comes from the guide; this is only interface chrome.
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
  { code: "bn", label: "বাংলা" },
] as const;

export const RTL = new Set(["ar", "ur", "he"]);

type Dict = Record<string, string>;
const en: Dict = {
  title: "EasyRead AI",
  tagline: "Turn a confusing letter or medicine label into simple steps with pictures.",
  upload: "Take or choose a photo of your document",
  device: "Optional: a photo of your inhaler, cream or drops",
  start: "Make my guide",
  sample: "Try the sample inhaler label",
  step: "Step",
  of: "of",
  next: "Next",
  back: "Back",
  read: "Read aloud",
  watch: "Watch how",
  noClip: "A checked video for this step is not available yet.",
  working: "Making your guide…",
  language: "Language",
  emergency: "Serious problem? Call 999.",
  ask: "Ask a question about your document",
  askGo: "Ask",
  sampleNote: "Sample document. Not a real patient.",
  noMedical: "This guide explains your own document. It is not medical advice. Ask your pharmacist or GP.",
  print: "Print",
  devPanel: "Tool calls",
};
const es: Dict = {
  ...en,
  tagline: "Convierte una carta o etiqueta de medicina en pasos simples con dibujos.",
  upload: "Haz o elige una foto de tu documento",
  device: "Opcional: una foto de tu inhalador, crema o gotas",
  start: "Crear mi guía",
  sample: "Probar la etiqueta de ejemplo",
  step: "Paso",
  of: "de",
  next: "Siguiente",
  back: "Atrás",
  read: "Leer en voz alta",
  watch: "Ver cómo",
  noClip: "Aún no hay un vídeo revisado para este paso.",
  working: "Creando tu guía…",
  language: "Idioma",
  emergency: "¿Problema grave? Llama al 999.",
  ask: "Haz una pregunta sobre tu documento",
  askGo: "Preguntar",
  sampleNote: "Documento de ejemplo. No es un paciente real.",
  noMedical: "Esta guía explica tu propio documento. No es consejo médico. Pregunta a tu farmacéutico o médico.",
  print: "Imprimir",
  devPanel: "Llamadas de herramientas",
};
const ar: Dict = {
  ...en,
  tagline: "حوّل رسالة أو ملصق دواء معقدًا إلى خطوات بسيطة مع صور.",
  upload: "التقط أو اختر صورة لمستندك",
  device: "اختياري: صورة لجهاز الاستنشاق أو الكريم أو القطرات",
  start: "أنشئ دليلي",
  sample: "جرّب ملصق جهاز الاستنشاق التجريبي",
  step: "الخطوة",
  of: "من",
  next: "التالي",
  back: "السابق",
  read: "اقرأ بصوت عالٍ",
  watch: "شاهد كيف",
  noClip: "لا يوجد فيديو موثّق لهذه الخطوة بعد.",
  working: "جارٍ إنشاء دليلك…",
  language: "اللغة",
  emergency: "مشكلة خطيرة؟ اتصل بـ 999.",
  ask: "اسأل عن مستندك",
  askGo: "اسأل",
  sampleNote: "مستند تجريبي. ليس مريضًا حقيقيًا.",
  noMedical: "يشرح هذا الدليل مستندك أنت. ليس نصيحة طبية. اسأل الصيدلي أو طبيبك.",
  print: "اطبع",
  devPanel: "استدعاءات الأدوات",
};
const dicts: Record<string, Dict> = { en, es, ar };

export function t(lang: string, key: string): string {
  return (dicts[lang] ?? en)[key] ?? en[key] ?? key;
}
