// Stand-in voice while the Anam avatar is unavailable. Tries the server's ElevenLabs
// endpoint (POST /api/tts {text, language} -> audio), then falls back to the browser voice.
let audio: HTMLAudioElement | null = null;
let ttsMissing = false;

export function stopSpeaking() {
  audio?.pause();
  audio = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function browserVoice(text: string, lang: string) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.speak(u);
}

export async function speak(text: string, lang: string): Promise<void> {
  stopSpeaking();
  if (!text) return;
  if (!ttsMissing) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: lang }),
      });
      if (res.ok && (res.headers.get("content-type") ?? "").startsWith("audio")) {
        audio = new Audio(URL.createObjectURL(await res.blob()));
        await audio.play();
        return;
      }
      if (res.status === 404 || res.status === 405) ttsMissing = true; // endpoint not built yet
    } catch {
      /* server unreachable: use the browser voice */
    }
  }
  browserVoice(text, lang);
}
