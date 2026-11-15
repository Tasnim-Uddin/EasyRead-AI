// The one audio owner. Anything that makes sound (read-aloud, the live guide, a clip) claims it first,
// which stops the others. Read-aloud tries the server's ElevenLabs endpoint (POST /api/tts) and falls
// back to the browser voice. Every speak() gets a token: a late reply after a newer claim never plays.
import { canSpeak, findWorld, markVoiceUnsupported } from "./languages";

let audio: HTMLAudioElement | null = null;
let ttsMissing = false;
let token = 0;

export type AudioOwner = "none" | "tts" | "guide" | "clip";
let owner: AudioOwner = "none";
/** Set by the app: quiets (true) or restores (false) the live guide's voice. */
let guideQuiet: (quiet: boolean) => void = () => {};
export function setGuideQuiet(fn: (quiet: boolean) => void) {
  guideQuiet = fn;
}

/** Voice speed, 0.6 (slow) to 1.2 (quick). Set from the settings screen. */
export const voiceSettings = { rate: 1 };

function stopTts() {
  token += 1; // cancels any read-aloud still fetching
  audio?.pause();
  audio = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Take the audio: stops whatever else is playing. */
export function claimAudio(who: AudioOwner) {
  if (who !== "tts") stopTts();
  if (who === "guide") guideQuiet(false);
  else if (who !== "none") guideQuiet(true);
  owner = who;
  notify();
}
const listeners = new Set<() => void>();
function notify() {
  for (const fn of listeners) fn();
}
/** Re-render on audio owner changes (the dock status chip). */
export function onAudioChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
/** Give the audio back (a clip ended): the guide may speak again. */
export function releaseAudio(who: AudioOwner) {
  if (owner !== who) return;
  owner = "none";
  if (who === "clip") guideQuiet(false);
  notify();
}
export const audioOwner = () => owner;

export function stopSpeaking() {
  stopTts();
  if (owner === "tts") {
    owner = "none";
    notify();
  }
}

function browserVoice(text: string, lang: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = findWorld(lang)?.code ?? lang;
  u.rate = voiceSettings.rate;
  window.speechSynthesis.speak(u);
}

export async function speak(text: string, lang: string): Promise<void> {
  stopTts();
  const mine = token;
  if (!text) return;
  if (!canSpeak(lang)) return; // never read foreign text with an English voice
  claimAudio("tts");
  if (!ttsMissing) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: lang }),
      });
      if (mine !== token) return; // stopped or replaced while fetching
      if (res.ok && (res.headers.get("content-type") ?? "").startsWith("audio")) {
        const blob = await res.blob();
        if (mine !== token) return;
        const a = new Audio(URL.createObjectURL(blob));
        a.onended = () => {
          if (audio === a && owner === "tts") {
            owner = "none";
            notify();
          }
        };
        a.playbackRate = voiceSettings.rate;
        audio = a;
        try {
          await a.play();
          return;
        } catch {
          if (mine !== token) return;
          audio = null; // autoplay blocked: use the browser voice below
        }
      } else if (res.status === 422) {
        markVoiceUnsupported(lang);
        if (canSpeak(lang)) browserVoice(text, lang);
        return;
      } else if (res.status === 404 || res.status === 405) ttsMissing = true;
    } catch {
      if (mine !== token) return;
    }
  }
  if (mine !== token) return;
  browserVoice(text, lang);
}
