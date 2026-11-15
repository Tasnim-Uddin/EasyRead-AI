// Plain translated messages for server errors that had only an English detail, plus the screen-reader "paused" word.
import { extendStrings } from "./i18n";

extendStrings({
  en: {
    errAccess: "Please enter the access code to continue.",
    errTextRequired: "There is nothing to read aloud yet. Add some text and try again.",
    errTextLong: "That is too much text to read aloud in one go. Try a shorter part.",
    errVoiceUnavailable: "The voice is not available right now. You can use the voice on your phone instead.",
    errVoiceFailed: "We could not make the voice. Please try again.",
    srPaused: "paused",
  },
  es: {
    errAccess: "Escriba el código de acceso para continuar.",
    errTextRequired: "Todavía no hay nada que leer en voz alta. Añada texto e inténtelo de nuevo.",
    errTextLong: "Es demasiado texto para leerlo en voz alta de una vez. Pruebe con una parte más corta.",
    errVoiceUnavailable: "La voz no está disponible ahora. Puede usar la voz de su teléfono.",
    errVoiceFailed: "No pudimos crear la voz. Inténtelo de nuevo.",
    srPaused: "en pausa",
  },
  ar: {
    errAccess: "من فضلك أدخل رمز الدخول للمتابعة.",
    errTextRequired: "لا يوجد نص للقراءة بصوت عالٍ بعد. أضف نصًا وحاول مرة أخرى.",
    errTextLong: "هذا النص طويل جدًا للقراءة دفعة واحدة. جرّب جزءًا أقصر.",
    errVoiceUnavailable: "الصوت غير متاح الآن. يمكنك استخدام الصوت في هاتفك.",
    errVoiceFailed: "تعذّر إنشاء الصوت. حاول مرة أخرى.",
    srPaused: "متوقف مؤقتًا",
  },
  ur: {
    errAccess: "جاری رکھنے کے لیے رسائی کوڈ درج کریں۔",
    errTextRequired: "ابھی بلند آواز سے پڑھنے کے لیے کوئی متن نہیں ہے۔ متن شامل کریں اور دوبارہ کوشش کریں۔",
    errTextLong: "یہ متن ایک بار میں پڑھنے کے لیے بہت لمبا ہے۔ چھوٹا حصہ آزمائیں۔",
    errVoiceUnavailable: "آواز ابھی دستیاب نہیں۔ آپ اپنے فون کی آواز استعمال کر سکتے ہیں۔",
    errVoiceFailed: "ہم آواز نہیں بنا سکے۔ دوبارہ کوشش کریں۔",
    srPaused: "رکا ہوا",
  },
  pl: {
    errAccess: "Wpisz kod dostępu, aby kontynuować.",
    errTextRequired: "Nie ma jeszcze nic do przeczytania na głos. Dodaj tekst i spróbuj ponownie.",
    errTextLong: "To za dużo tekstu do przeczytania naraz. Spróbuj krótszego fragmentu.",
    errVoiceUnavailable: "Głos jest teraz niedostępny. Możesz użyć głosu w telefonie.",
    errVoiceFailed: "Nie udało się utworzyć głosu. Spróbuj ponownie.",
    srPaused: "wstrzymano",
  },
  bn: {
    errAccess: "চালিয়ে যেতে অ্যাক্সেস কোড দিন।",
    errTextRequired: "জোরে পড়ার মতো কোনো লেখা এখনও নেই। লেখা যোগ করে আবার চেষ্টা করুন।",
    errTextLong: "একবারে জোরে পড়ার জন্য এই লেখা অনেক বড়। ছোট একটি অংশ চেষ্টা করুন।",
    errVoiceUnavailable: "এখন ভয়েস পাওয়া যাচ্ছে না। আপনি ফোনের ভয়েস ব্যবহার করতে পারেন।",
    errVoiceFailed: "আমরা ভয়েস তৈরি করতে পারিনি। আবার চেষ্টা করুন।",
    srPaused: "থামানো আছে",
  },
});
