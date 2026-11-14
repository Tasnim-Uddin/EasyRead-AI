import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Clip, Guide, GuideStatus, Step, ToolLogEntry } from "./types";
import { LANGUAGES, isFallback, t, tf } from "./i18n";
import { Counted, Counter, CountThen, T } from "./bidi";
import { canSpeak, findWorld, isRtl, languageLabel, languageValue, searchLanguages } from "./languages";
import Icon, { GuideFace } from "./icons";
import { speak } from "./speech";
import type { AnamState } from "./useAnam";

export const AVATAR_VIDEO_ID = "anam-video";
export const MAX_FILES = 8;

/* ---------- the one live avatar video, kept mounted for the whole session ---------- */
export interface LiveInfo {
  live: boolean;
  lang: string;
  onEnd: () => void;
  micMuted: boolean;
  soundOff: boolean;
  onToggleMic: () => void;
  onToggleSound: () => void;
}
export const LiveContext = createContext<LiveInfo | null>(null);
const useLive = () => {
  const c = useContext(LiveContext);
  return c && c.live ? c : null;
};

/**
 * Rendered once at App level (never unmounted), so the avatar stream survives screen changes.
 * It sits over whichever [data-avatar-slot] the current screen shows (large stage on Talk, small
 * face in the guide row on Step/Ask). With no slot (clip, settings...) it floats as a small tile.
 */
export function AvatarHost({ live, screen }: { live: boolean; screen: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    let slot: Element | null = null;
    let ro: ResizeObserver | null = null;
    const place = () => {
      if (!slot || !slot.isConnected) return;
      const r = slot.getBoundingClientRect();
      Object.assign(host.style, {
        top: `${r.top + window.scrollY}px`,
        left: `${r.left + window.scrollX}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
    };
    const find = () => {
      const next = document.querySelector("[data-avatar-slot]");
      if (next === slot) return place();
      ro?.disconnect();
      slot = next;
      host.dataset.mode = slot ? (slot.getAttribute("data-avatar-slot") ?? "face") : "float";
      if (!slot) {
        for (const k of ["top", "left", "width", "height"]) host.style.removeProperty(k);
        return;
      }
      ro = new ResizeObserver(place);
      ro.observe(slot);
      ro.observe(document.body);
      place();
    };
    find();
    // slots can appear a frame after the screen (lists, images): re-check as the page settles
    const mo = new MutationObserver(find);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", place);
    return () => {
      mo.disconnect();
      ro?.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [screen, live]);
  const info = useContext(LiveContext);
  return (
    <div ref={ref} className="avhost" data-mode="float" data-live={live ? "1" : "0"}>
      <video id={AVATAR_VIDEO_ID} autoPlay playsInline />
      {live && info && (
        <button className="avend" onClick={info.onEnd} aria-label={t(info.lang, "endTalk")}>
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}

/** Stand-in face, or the empty slot the live avatar is shown over. */
function GuideOrAvatar({ live }: { live: LiveInfo | null }) {
  return live ? <div className="avslot face" data-avatar-slot="face" /> : <GuideFace />;
}

/** Small End / mic / sound buttons next to the live tile. */
function LiveControls({ live }: { live: LiveInfo }) {
  const { lang } = live;
  return (
    <div className="livectl">
      <button className="end" onClick={live.onEnd}>
        {t(lang, "endTalk")}
      </button>
      <button onClick={live.onToggleMic} aria-pressed={live.micMuted} aria-label={t(lang, live.micMuted ? "unmuteMic" : "muteMic")}>
        <Icon name="mic" />
      </button>
      <button onClick={live.onToggleSound} aria-pressed={live.soundOff} aria-label={t(lang, live.soundOff ? "soundOn" : "soundOff")}>
        <Icon name="play" />
      </button>
    </div>
  );
}
export const ROLES = ["auto", "label", "leaflet", "device_photo", "letter", "form", "other"] as const;
export type Role = (typeof ROLES)[number];
export interface TrayItem {
  id: number;
  file: File;
  role: Role;
  url: string | null;
}

const ROLE_KEY: Record<string, string> = {
  auto: "roleAuto",
  label: "roleLabel",
  leaflet: "roleLeaflet",
  device_photo: "roleDevice",
  letter: "roleLetter",
  form: "roleForm",
  other: "roleOther",
};
export const roleName = (lang: string, role: string) => t(lang, ROLE_KEY[role] ?? "roleOther");

export type Kind = "medicine" | "howto" | "letter" | "form";
export function kindOf(g: Guide): Kind {
  const dt = g.doc_type ?? "how_to";
  if (dt === "form") return "form";
  if (dt !== "how_to") return "letter";
  return g.domain === "medicine" || (!g.domain && !!g.facts?.medicine) ? "medicine" : "howto";
}

/* ---------- shared bars ---------- */
const OTHER = "__other__";
const isPreset = (lang: string) => LANGUAGES.some((l) => l.code === lang);

/* "Other language…": search a built-in list of common languages, or type any language. */
export function LanguageDialog({ lang, onPick, onClose }: { lang: string; onPick: (c: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const found = searchLanguages(q);
  const typed = q.trim();
  const typedValue = typed ? languageValue(typed) : "";
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="langdlg" role="dialog" aria-modal="true" aria-label={t(lang, "otherLanguage")} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="card">
        <div className="row">
          <input
            ref={ref}
            type="text"
            value={q}
            maxLength={40}
            placeholder={t(lang, "searchLanguage")}
            aria-label={t(lang, "searchLanguage")}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && typedValue && onPick(found.length === 1 ? found[0].code : typedValue)}
          />
          <button className="round" onClick={onClose} aria-label={t(lang, "closeX")}>
            <Icon name="x" />
          </button>
        </div>
        {typed && !found.some((w) => w.code === typedValue) && (
          <button className="chip on" onClick={() => onPick(typedValue)}>
            {t(lang, "useTyped")} “{typed}”
          </button>
        )}
        <ul>
          {found.map((w) => (
            <li key={w.code}>
              <button className={"chip" + (w.code === lang ? " on" : "")} onClick={() => onPick(w.code)}>
                <span dir="auto">{w.native}</span>
                {w.native !== w.en && <small> {w.en}</small>}
              </button>
            </li>
          ))}
        </ul>
        {typed && !found.length && <p className="help">{t(lang, "noMatch")}</p>}
      </div>
    </div>
  );
}

export function LangPill({ lang, onLanguage }: { lang: string; onLanguage: (c: string) => void }) {
  const [other, setOther] = useState(false);
  const current = languageLabel(lang);
  return (
    <>
    <label className="lang">
      <span className="sr">{t(lang, "language")}</span>
      {current}
      <b />
      <select
        value={lang}
        onChange={(e) => {
          if (e.target.value === OTHER) setOther(true);
          else onLanguage(e.target.value);
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
        {!isPreset(lang) && <option value={lang}>{current}</option>}
        <option value={OTHER}>{t(lang, "otherLanguage")}</option>
      </select>
    </label>
    {other && (
      <LanguageDialog
        lang={lang}
        onClose={() => setOther(false)}
        onPick={(c) => {
          setOther(false);
          onLanguage(c);
        }}
      />
    )}
    </>
  );
}

export function TopBar({ lang, onLanguage, onSettings, onBrand }: { lang: string; onLanguage: (c: string) => void; onSettings: () => void; onBrand?: () => void }) {
  return (
    <div className="top">
      <button className="brand" onClick={onBrand} disabled={!onBrand}>
        <i />
        EasyRead
      </button>
      <div className="top-right">
        <LangPill lang={lang} onLanguage={onLanguage} />
        <button className="round" onClick={onSettings} aria-label={t(lang, "settings")}>
          <Icon name="sliders" />
        </button>
      </div>
    </div>
  );
}

export function TitleBar({ title, lang, onBack, right }: { title: string; lang: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="title-top">
      <button className="round" onClick={onBack} aria-label={t(lang, "back2")}>
        <Icon name="back" />
      </button>
      <h1>{title}</h1>
      {right}
    </div>
  );
}

/* Persistent 999 link: shown on every guide screen (same rule as the home screen: all document kinds). */
export function EmergencyLink({ lang, warn }: { lang: string; warn?: boolean }) {
  return (
    <a className={"sos" + (warn ? " warn" : "")} href="tel:999">
      <Icon name="alert" style={{ width: 20, height: 20 }} />
      <T lang={lang} k="emergencyLink" />
    </a>
  );
}

/* ---------- 1. home ---------- */
interface HomeProps {
  lang: string;
  onLanguage: (c: string) => void;
  onSettings: () => void;
  onCamera: () => void;
  onUpload: () => void;
  onSample: (name: string) => void;
}
export function Home({ lang, onLanguage, onSettings, onCamera, onUpload, onSample }: HomeProps) {
  return (
    <div className="screen">
      <TopBar lang={lang} onLanguage={onLanguage} onSettings={onSettings} />
      <div className="hero">
        <h1>
          {t(lang, "homeTitleA")}
          <br />
          {t(lang, "homeTitleB")}
        </h1>
        <p>{t(lang, "homeLead")}</p>
        <button className="scan" onClick={onCamera}>
          <div className="blob" />
          <div className="blob2" />
          <div className="cam">
            <Icon name="camera" />
          </div>
          <span className="lbl">{t(lang, "scanLabel")}</span>
        </button>
        <button className="btn soft" onClick={onUpload}>
          <Icon name="upload" />
          {t(lang, "upload")}
        </button>
        <p className="help">{t(lang, "private")}</p>
        <div className="samples">
          <span style={{ flexBasis: "100%", textAlign: "center" }}>{t(lang, "trySample")}</span>
          <button onClick={() => onSample("inhaler")}>{t(lang, "sampleInhaler")}</button>
          <button onClick={() => onSample("council")}>{t(lang, "sampleLetter")}</button>
          <button onClick={() => onSample("flatpack")}>{t(lang, "sampleFlatpack")}</button>
        </div>
        <p className="help">
          <a href="tel:999">
            <T lang={lang} k="emergencyLink" />
          </a>
        </p>
      </div>
    </div>
  );
}

/* ---------- 2a. check photo ---------- */
export function CheckPhoto({ lang, url, name, onRetake, onUse, onBack }: { lang: string; url: string | null; name: string; onRetake: () => void; onUse: () => void; onBack: () => void }) {
  return (
    <div className="screen">
      <TitleBar title={t(lang, "checkPhoto")} lang={lang} onBack={onBack} />
      <div className="photo">
        {url ? <img src={url} alt="" /> : <Icon name="doc" size={72} style={{ color: "#fff" }} />}
        <div className="frame" />
      </div>
      <h2 className="ttl" style={{ fontSize: 26, paddingTop: 16 }}>
        {t(lang, "canRead")}
      </h2>
      <p className="sub" style={{ paddingTop: 4, fontSize: 18 }}>
        {url ? t(lang, "canReadHint") : name}
      </p>
      <div className="row2" style={{ marginTop: "auto", paddingBottom: 28 }}>
        <button className="btn soft" style={{ flex: "0 0 38%" }} onClick={onRetake}>
          {t(lang, "retake")}
        </button>
        <button className="btn" onClick={onUse}>
          {t(lang, "useThis")}
        </button>
      </div>
    </div>
  );
}

/* ---------- 2b. page tray ---------- */
interface TrayProps {
  lang: string;
  items: TrayItem[];
  busy: boolean;
  tooMany: boolean;
  onLanguage: (c: string) => void;
  onSettings: () => void;
  onAdd: () => void;
  onRole: (id: number, r: Role) => void;
  onRemove: (id: number) => void;
  onMove: (id: number, d: -1 | 1) => void;
  onMake: () => void;
}
export function Tray({ lang, items, busy, tooMany, onLanguage, onSettings, onAdd, onRole, onRemove, onMove, onMake }: TrayProps) {
  const n = items.length;
  return (
    <div className="screen">
      <TopBar lang={lang} onLanguage={onLanguage} onSettings={onSettings} />
      <h1 className="ttl">{t(lang, "yourPapers")}</h1>
      <p className="sub">
        {n} {t(lang, n === 1 ? "item" : "items")} {t(lang, "itemsReady")}.
      </p>
      <ul className="tray">
        {items.map((it, i) => (
          <li className="item" key={it.id}>
            <div className="th">{it.url ? <img src={it.url} alt="" /> : <Icon name="doc" />}</div>
            <div className="meta">
              <b>
                {t(lang, "page")} {i + 1}
              </b>
              <label className="tag">
                <span className="sr">{t(lang, "paperKind")}</span>
                {roleName(lang, it.role)}
                <i />
                <select value={it.role} onChange={(e) => onRole(it.id, e.target.value as Role)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleName(lang, r)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="ctrls">
              <button onClick={() => onMove(it.id, -1)} disabled={i === 0} aria-label={t(lang, "moveUp")}>
                <Icon name="up" />
              </button>
              <button onClick={() => onMove(it.id, 1)} disabled={i === n - 1} aria-label={t(lang, "moveDown")}>
                <Icon name="down" />
              </button>
            </div>
            <button className="round" onClick={() => onRemove(it.id)} aria-label={`${t(lang, "remove")} ${it.file.name}`}>
              <Icon name="trash" />
            </button>
          </li>
        ))}
        <li>
          <button className="add" onClick={onAdd} disabled={n >= MAX_FILES}>
            <Icon name="plus" />
            {t(lang, "addAnother")}
          </button>
        </li>
      </ul>
      {tooMany ? (
        <p className="banner" role="alert">
          {t(lang, "maxFiles")}
        </p>
      ) : (
        n > 1 && (
          <p className="hint">
            <Icon name="up" />
            {t(lang, "reorderHint")}
          </p>
        )
      )}
      <div className="foot">
        <button className="btn" onClick={onMake} disabled={n === 0 || busy}>
          {t(lang, "makeGuide")}
          <Icon name="arrow" />
        </button>
      </div>
    </div>
  );
}

/* ---------- 3. reading ---------- */
export function Reading({ lang, status }: { lang: string; status: GuideStatus | "uploading" }) {
  const stage = status === "uploading" || status === "extracting" ? 0 : status === "writing" ? 1 : 2;
  const rows = ["rowRead", "rowSimple", "rowPictures"];
  return (
    <div className="screen" role="status" aria-live="polite">
      <div className="top">
        <div className="brand">
          <i />
          EasyRead
        </div>
      </div>
      <div className="center">
        <div className="paper">
          <div className="sheet b" />
          <div className="sheet" />
          <div className="sun" />
          {[60, 88, 116, 144, 172].map((top, i) => (
            <div key={top} className={"ln" + (i < 2 ? " on" : "")} style={{ top, width: [92, 110, 80, 104, 60][i] }} />
          ))}
        </div>
        <h2>{t(lang, "readingTitle")}…</h2>
        <p>{t(lang, "readingHint")}</p>
        <div className="list">
          {rows.map((r, i) => (
            <div key={r} className={i < stage ? "done" : i === stage ? "now" : "wait"}>
              <span className="dot">{i < stage && <Icon name="check" />}</span>
              {t(lang, r)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- 4. summary first ---------- */
const FALLBACK_SAFETY: Record<Kind, string> = {
  medicine: "Not sure? Ask your pharmacist. For advice, call 111. In an emergency, call 999.",
  howto: "If something breaks or feels unsafe, stop and ask for help.",
  letter: "Get free advice before you sign or pay. Citizens Advice can help: 0800 144 8848.",
  form: "Get free advice before you sign or pay. Citizens Advice can help: 0800 144 8848.",
};
export const safetyLines = (g: Guide) => (g.safety_lines && g.safety_lines.length ? g.safety_lines : [FALLBACK_SAFETY[kindOf(g)]]);

export function summaryText(g: Guide): string {
  const k = kindOf(g);
  const c = g.content;
  if (k === "letter" || k === "form") {
    if (k === "form") return (c?.fields ?? []).map((f) => `${f.label}. ${f.what_to_write}`).join(" ");
    return [c?.what_this_is, ...(c?.what_to_do ?? []), ...(c?.by_when ?? []).map((b) => `${b.date}: ${b.what}`)].filter(Boolean).join(" ");
  }
  const f = g.facts;
  return [f?.medicine ?? f?.title, f?.dose, f?.frequency].filter(Boolean).join(". ") + `. ${g.steps.length} ${t(g.language, "steps")}.`;
}

function DeviceCard({ guide, lang }: { guide: Guide; lang: string }) {
  const [original, setOriginal] = useState(false);
  const src = guide.source;
  if (!src.device_photo_labelled_url) return null;
  const orig = src.device_photo_url;
  const labels = src.device_photo_labels ?? [];
  const title = t(lang, guide.facts?.device_type?.startsWith("inhaler") ? "yourInhaler" : "yourItem");
  const showOrig = original && !!orig;
  return (
    <div className="card device">
      <div className="k">{title}</div>
      <img src={showOrig ? orig! : src.device_photo_labelled_url} alt={`${title}. ${t(lang, "itemCaption")}`} />
      <p dir="auto">{t(lang, "itemCaption")}</p>
      {!showOrig && labels.length > 0 && (
        <ol className="legend" dir="auto">
          {labels.map((x) => (
            <li key={x}>{t(lang, "part_" + x)}</li>
          ))}
        </ol>
      )}
      {orig && (
        <button className="btn soft small" onClick={() => setOriginal(!original)}>
          {t(lang, showOrig ? "showLabelled" : "showOriginal")}
        </button>
      )}
    </div>
  );
}

interface SummaryProps {
  guide: Guide;
  lang: string;
  onLanguage: (c: string) => void;
  onSettings: () => void;
  onBack: () => void;
  onStart: () => void;
  onListen: () => void;
}
export function Summary({ guide, lang, onLanguage, onSettings, onBack, onStart, onListen }: SummaryProps) {
  const k = kindOf(guide);
  const f = guide.facts;
  const c = guide.content;
  const docs = guide.source.documents ?? [];
  const sources = docs.length ? docs.map((d) => roleName(lang, d.role)) : [];
  const conflicts = f?.conflicts ?? [];
  const warnings = (f?.warnings ?? []).filter((w) => !w.startsWith("Your label and leaflet say different"));
  const title =
    k === "letter" ? c?.what_this_is : k === "form" ? f?.title ?? t(lang, "boxByBox") : f?.medicine ?? f?.title ?? t(lang, "yourPaper");
  const subline = k === "medicine" ? guide.summary_line || [f?.dose, f?.frequency].filter(Boolean).join(", ") : "";
  return (
    <div className="screen">
      <TopBar lang={lang} onLanguage={onLanguage} onSettings={onSettings} onBrand={onBack} />
      <div className="card sage" style={{ marginTop: 14 }}>
        <div className="k">{t(lang, "thisIs")}</div>
        <div className="big">{title}</div>
        {subline && <p>{subline}</p>}
      </div>

      <DeviceCard guide={guide} lang={lang} />

      {conflicts.length > 0 && (
        <div className="card butter" role="alert">
          <div className="k">{t(lang, "conflictTitle")}</div>
          {conflicts.map((x, i) => (
            <div className="conflict" key={i}>
              <span>
                <b>{t(lang, "conflictLabel")}:</b> {x.label}
              </span>
              <span>
                <b>{t(lang, "conflictLeaflet")}:</b> {x.leaflet}
              </span>
            </div>
          ))}
          <p>{t(lang, "conflictAsk")}</p>
        </div>
      )}

      {k === "letter" && (c?.what_to_do?.length ?? 0) > 0 && (
        <div className="card">
          <div className="k">{t(lang, "whatToDo")}</div>
          <ol>
            {c!.what_to_do!.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </div>
      )}

      {k === "letter" && ((c?.by_when?.length ?? 0) > 0 || (c?.amounts?.length ?? 0) > 0) && (
        <div className="facts">
          {(c?.by_when ?? []).map((b, i) => (
            <div className="fact butter" key={"d" + i}>
              <div className="k">{t(lang, "byWhen")}</div>
              <div className="v">{b.date}</div>
              <div className="w">{b.what}</div>
            </div>
          ))}
          {(c?.amounts ?? []).map((a, i) => (
            <div className="fact" key={"a" + i}>
              <div className="k">{a.what}</div>
              <div className="v">{a.amount}</div>
            </div>
          ))}
        </div>
      )}

      {k === "form" && (
        <div className="card">
          <div className="k">{t(lang, "boxByBox")}</div>
          <ol>
            {(c?.fields ?? []).map((x, i) => (
              <li key={i}>
                <b>{x.label}:</b> {x.what_to_write}
              </li>
            ))}
          </ol>
        </div>
      )}

      {(k === "medicine" || k === "howto") && (
        <div className="facts">
          <div className="fact">
            <div className="k">{t(lang, "youWillLearn")}</div>
            <div className="v">
              <CountThen lang={lang} k="steps" count={guide.steps.length} />
            </div>
          </div>
          {k === "medicine" && f?.dose && (
            <div className="fact">
              <div className="k">{t(lang, "dosage")}</div>
              <div className="v">{f.dose}</div>
            </div>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="card butter">
          <div className="k">{t(lang, "goodToKnow")}</div>
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      {(f?.unreadable?.length ?? 0) > 0 && (
        <p className="banner" role="alert">
          {t(lang, "unreadable")} {f!.unreadable.join("; ")}
        </p>
      )}

      {sources.length > 0 && (k === "medicine" || k === "howto") && (
        <div className="card">
          <div className="k">{t(lang, "fromPapers")}</div>
          <div className="src">
            {sources.map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {guide.status === "illustrating" && guide.steps.some(pictureComing) && (
        <p className="safe" role="status">
          {t(lang, "rowPictures")}…
        </p>
      )}
      {guide.source.is_sample && <p className="safe">{t(lang, "sampleNote")}</p>}
      <p className="safe" dir="auto">
        {safetyLines(guide).map((l, i) => (
          <span key={i}>
            {l}{" "}
          </span>
        ))}
      </p>

      <div className="foot sticky">
        <button className="btn" onClick={onStart}>
          {t(lang, k === "letter" || k === "form" ? "showSteps" : "startStep")}
        </button>
        {canSpeak(lang) && (
          <button className="btn soft" onClick={onListen}>
            <Icon name="play" />
            {t(lang, "listenThis")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- 5. step ---------- */
const KIND_ICON: Record<string, string> = { what: "doc", when: "sun", how: "hand", warning: "alert", get_help: "alert" };

export const pictureComing = (s: Step) => !s.image_url && (s.status === "pending" || s.status === "generating");

function StepPicture({ step, lang }: { step: Step; lang: string }) {
  const butter = step.kind === "warning" || step.kind === "get_help";
  const badge = butter ? (
    <div className="badge">
      <Icon name="alert" />
      {t(lang, step.kind === "warning" ? "goodToKnow" : "getHelp")}
    </div>
  ) : null;
  if (step.image_url) {
    // Pictures carry no words, so they work in every language.
    return (
      <div className={"pic" + (butter ? " warn" : "")}>
        {badge}
        <img src={step.image_url} alt="" />
      </div>
    );
  }
  const icon = <Icon name={KIND_ICON[step.kind] ?? "doc"} style={butter ? { width: 72, height: 72, strokeWidth: 2.6 } : undefined} />;
  if (pictureComing(step)) {
    // Same box as the finished picture, so nothing jumps when it arrives.
    return (
      <div className={"pic loading" + (butter ? " warn" : " ph")} role="img" aria-label={t(lang, "rowPictures")}>
        {badge}
        {icon}
      </div>
    );
  }
  // No picture (failed or offline): the step text is enough. A calm icon, no error text.
  return (
    <div className={"pic" + (step.status === "failed" ? "" : " small") + (butter ? " warn" : " ph")}>
      {badge}
      {icon}
    </div>
  );
}

interface StepProps {
  guide: Guide;
  index: number;
  lang: string;
  clips: Clip[];
  onClose: () => void;
  onIndex: (i: number) => void;
  onFinish: () => void;
  onShowHow: () => void;
}
export function stepHasHow(guide: Guide, step: Step, clips: Clip[]) {
  const clip = step.technique_clip_id ? clips.find((c) => c.id === step.technique_clip_id) : undefined;
  return !!clip || (kindOf(guide) !== "letter" && kindOf(guide) !== "form" && step.kind === "how");
}
export function StepScreen({ guide, index, lang, clips, onClose, onIndex, onFinish, onShowHow }: StepProps) {
  const live = useLive();
  const step = guide.steps[index];
  if (!step) return null;
  const total = guide.steps.length;
  const last = index >= total - 1;
  return (
    <div className="screen">
      <div className="prog">
        <button className="round" onClick={onClose} aria-label={t(lang, "close")}>
          <Icon name="x" />
        </button>
        <div className="bars">
          {guide.steps.map((s) => (
            <button key={s.index} className={s.index <= index ? "d" : ""} onClick={() => onIndex(s.index)} aria-label={`${t(lang, "step")} ${s.index + 1}`} />
          ))}
        </div>
        <div className="of">
          <Counter lang={lang} n={index + 1} total={total} />
        </div>
      </div>
      <EmergencyLink lang={lang} warn={step.kind === "warning" || step.kind === "get_help"} />
      <StepPicture step={step} lang={lang} />
      <div className="step" aria-live="polite" dir="auto">
        {step.text}
      </div>
      <div className="actions">
        {canSpeak(lang) && (
          <button className="btn" onClick={() => void speak(step.text, lang)}>
            <Icon name="play" />
            {t(lang, "listen")}
          </button>
        )}
        {stepHasHow(guide, step, clips) && (
          <button className="btn soft" onClick={onShowHow}>
            <Icon name="play" style={{ width: 24, height: 24 }} />
            {t(lang, "showHow")}
          </button>
        )}
      </div>
      <div className="guide">
        <GuideOrAvatar live={live} />
        <div className="bubble" dir="auto">
          <b>{t(lang, "guideSays")}</b>
          {step.say || step.text}
        </div>
        {live && <LiveControls live={live} />}
      </div>
      <div className="nav">
        <button className="btn soft back" onClick={() => onIndex(index - 1)} disabled={index === 0}>
          {t(lang, "back")}
        </button>
        <button className="btn next" onClick={last ? onFinish : () => onIndex(index + 1)}>
          {t(lang, last ? "finish" : "next")}
          <Icon name="arrow" />
        </button>
      </div>
    </div>
  );
}

/* ---------- 6. show me how ---------- */
export function ClipScreen({ guide, index, lang, clips, onBack }: { guide: Guide; index: number; lang: string; clips: Clip[]; onBack: () => void }) {
  const step = guide.steps[index];
  const clip = step?.technique_clip_id ? clips.find((c) => c.id === step.technique_clip_id) : undefined;
  const vid = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (vid.current) vid.current.playbackRate = slow ? 0.5 : 1;
  }, [slow, playing]);
  if (!step) return null;
  const play = () => {
    setPlaying(true);
    if (vid.current) void vid.current.play();
    else void speak(step.text, lang);
  };
  return (
    <div className="screen">
      <div className="prog">
        <button className="round" onClick={onBack} aria-label={t(lang, "close")}>
          <Icon name="x" />
        </button>
        <div className="ttl" style={{ padding: 0, fontSize: 26 }}>
          {t(lang, "clipTitle")}
        </div>
      </div>
      <div className="clip">
        {clip ? (
          <video ref={vid} src={clip.video_url} poster={clip.poster_url} loop muted playsInline controls={playing} aria-label={clip.caption_en} />
        ) : step.image_url ? (
          <img src={step.image_url} alt="" />
        ) : pictureComing(step) ? (
          <div className="loading fill" role="img" aria-label={t(lang, "rowPictures")}>
            <Icon name="hand" size={72} />
          </div>
        ) : (
          <Icon name="hand" size={72} />
        )}
        {!playing && (
          <button className="play" onClick={play} aria-label={t(lang, "playAgain")}>
            <Icon name="play" />
          </button>
        )}
      </div>
      <div className="cap">{clip?.caption_en ?? step.text}</div>
      {clip?.unchecked ? (
        <div className="check butter">
          <Icon name="alert" />
          {t(lang, "clipUnchecked")}
        </div>
      ) : clip ? (
        <div className="check">
          <Icon name="check" />
          {(clip.checked_against ?? "").includes("nhs.uk") ? t(lang, "clipNhs") : t(lang, "clipChecked")}
        </div>
      ) : (
        <div className="check butter">
          <Icon name="alert" />
          {t(lang, "clipMissing")}
        </div>
      )}
      <div className="row2">
        <button className="btn soft" onClick={play}>
          {t(lang, "playAgain")}
        </button>
        <button className="btn soft" onClick={() => setSlow(!slow)} aria-pressed={slow}>
          {t(lang, "slower")}
        </button>
      </div>
      <div className="nav">
        <button className="btn" onClick={onBack}>
          {t(lang, "close")}
        </button>
      </div>
    </div>
  );
}

/* ---------- 7. ask / finish ---------- */
const CHIPS: Record<Kind, string[]> = {
  medicine: ["How much do I take?", "What if I miss one?", "Can I eat first?"],
  letter: ["What do I need to do?", "When is the deadline?", "Who do I call?"],
  form: ["What do I write first?", "Which boxes can stay empty?"],
  howto: ["What do I do first?", "What if a part is missing?"],
};

interface AskProps {
  guide: Guide;
  lang: string;
  question: string;
  answer: string | null;
  busy: boolean;
  onQuestion: (q: string) => void;
  onAsk: (q?: string) => void;
  onTalk: () => void;
  onTellBack: () => void;
  onPrint: () => void;
  onBack: () => void;
}
export function AskScreen({ guide, lang, question, answer, busy, onQuestion, onAsk, onTalk, onTellBack, onPrint, onBack }: AskProps) {
  const live = useLive();
  const k = kindOf(guide);
  const heading = t(lang, k === "medicine" ? "askAboutMedicine" : "askAboutPaper");
  const [listening, setListening] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const SR = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const Rec = SR.SpeechRecognition ?? SR.webkitSpeechRecognition;

  function mic() {
    if (!Rec) {
      input.current?.focus();
      return;
    }
    const r = new Rec();
    r.lang = findWorld(lang)?.code ?? lang;
    r.interimResults = false;
    r.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const text = e.results[0][0].transcript;
      onQuestion(text);
      onAsk(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }

  return (
    <div className="screen">
      <EmergencyLink lang={lang} />
      <div className="done-card">
        <div className="tick">
          <Icon name="check" />
        </div>
        <div>
          <strong dir={isFallback(lang, "allDone") ? "ltr" : undefined}>{tf(lang, "allDone", { n: guide.steps.length })}</strong>
          {t(lang, "allDoneSub")}
        </div>
      </div>
      {live && (
        <div className="guide">
          <GuideOrAvatar live={live} />
          <LiveControls live={live} />
        </div>
      )}
      <div className="ask">
        <h2>
          {heading}
        </h2>
        <label>
          <span className="sr">{t(lang, "askExample")}</span>
          <textarea
            ref={input}
            className="q"
            value={question}
            placeholder={t(lang, "askExample")}
            onChange={(e) => onQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onAsk();
              }
            }}
          />
        </label>
        {question.trim() && (
          <button className="btn ask-go" onClick={() => onAsk()} disabled={busy}>
            {busy ? t(lang, "thinking") + "…" : t(lang, "ask")}
          </button>
        )}
        <div className="mic">
          <button className="m" onClick={mic} aria-label={t(lang, "tapSpeak")}>
            <Icon name="mic" />
          </button>
          <span>{listening ? t(lang, "listening") + "…" : <>{t(lang, "tapSpeak")}<br />{t(lang, "orType")}</>}</span>
        </div>
        <div className="chips">
          {CHIPS[k].map((c) => (
            <button
              key={c}
              className="chip"
              disabled={busy}
              onClick={() => {
                onQuestion(c);
                onAsk(c);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {answer && (
        <div className="answer" aria-live="polite">
          <b>{t(lang, "guideSays")}</b>
          {answer}
        </div>
      )}
      <p className="safe">
        <b>{t(lang, "notSure")}</b> {safetyLines(guide).map((l) => l.replace(/^Not sure\?\s*/, "")).join(" ")}
      </p>
      <div className="save">
        <div className="row2" style={{ padding: 0 }}>
          <button className="btn soft" onClick={onTellBack}>
            {t(lang, "tellBack")}
          </button>
          <button className="btn soft" onClick={onTalk}>
            {t(lang, "talkGuide")}
          </button>
        </div>
        <button className="btn" onClick={onPrint}>
          <Icon name="print" />
          {t(lang, "savePrint")}
        </button>
        <button className="btn soft" onClick={onBack}>
          {t(lang, "back2")}
        </button>
      </div>
    </div>
  );
}

/* ---------- 8. talk to your guide ---------- */
interface TalkProps {
  lang: string;
  state: AnamState;
  error: string | null;
  caption: string;
  onLanguage: (c: string) => void;
  onBack: () => void;
  onStart: () => void;
  onStop: () => void;
  onType: () => void;
  sttMissing?: boolean;
  micMuted?: boolean;
  soundOff?: boolean;
  onToggleMic?: () => void;
  onToggleSound?: () => void;
}
export function TalkScreen({ lang, state, error, sttMissing, caption, onLanguage, onBack, onStart, onStop, onType, micMuted, soundOff, onToggleMic, onToggleSound }: TalkProps) {
  const live = state === "live";
  return (
    <div className="screen">
      <TitleBar title={t(lang, "yourGuideTitle")} lang={lang} onBack={onBack} right={<LangPill lang={lang} onLanguage={onLanguage} />} />
      <div className="stage">
        {!live && <GuideFace large />}
        {live && <div className="avslot" data-avatar-slot="stage" />}
      </div>
      {caption ? (
        <div className="live" aria-live="polite">
          {caption}
        </div>
      ) : (
        <div className="live empty">{t(lang, "captionEmpty")}</div>
      )}
      {state === "error" && (
        <p className="banner" role="alert">
          {t(lang, "talkError")}
          {error ? ` ${error}` : ""}
        </p>
      )}
      {sttMissing && (
        <p className="banner" role="status">
          {t(lang, "sttTypeNote")}
        </p>
      )}
      {state === "standin" && (
        <p className="banner" role="status">
          {t(lang, "talkStandin")}
        </p>
      )}
      {live && (
        <div className="foot" style={{ flexDirection: "row", gap: "0.75rem", padding: "0.875rem 1.5rem 0" }}>
          <button className="btn soft" onClick={onToggleMic} aria-pressed={!!micMuted}>
            {t(lang, micMuted ? "unmuteMic" : "muteMic")}
          </button>
          <button className="btn soft" onClick={onToggleSound} aria-pressed={!!soundOff}>
            {t(lang, soundOff ? "soundOn" : "soundOff")}
          </button>
        </div>
      )}
      <div className="micbig">
        <button className="m" onClick={live ? onStop : onStart} disabled={state === "connecting"} aria-label={t(lang, live ? "endTalk" : "startTalk")}>
          <Icon name={live ? "x" : "mic"} />
        </button>
        <span>{state === "connecting" ? "…" : live ? t(lang, "listening") + "…" : t(lang, "startTalk")}</span>
      </div>
      <button className="txt" onClick={onType}>
        {t(lang, "typeInstead")}
      </button>
    </div>
  );
}

/* ---------- 9. tell me back ---------- */
export interface Question {
  q: string;
  options: string[];
  correct: number;
  icons: string[];
}
export function buildQuestions(g: Guide): Question[] {
  const k = kindOf(g);
  const out: Question[] = [];
  const mk = (q: string, correct: string, wrong: string[], pos: number): Question => {
    const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
    const options = wrong.map(cap);
    options.splice(Math.min(pos, options.length), 0, cap(correct));
    return { q, options, correct: options.indexOf(cap(correct)), icons: ["sun", "bulb", "hand"] };
  };
  const f = g.facts;
  const c = g.content;
  if (k === "medicine" && f?.frequency) out.push(mk("When do you use it?", f.frequency, ["Every morning", "Only at night"].filter((x) => x !== f.frequency), 1));
  if (k === "medicine" && (f?.conflicts?.length ?? 0) > 0)
    out.push(mk("Your label and leaflet say different things. What do you do?", "Ask your pharmacist before you use it", ["Use the bigger dose", "Pick the one you like"], 1));
  else if (k === "medicine" && f?.dose) out.push(mk("How much do you take?", f.dose, ["As much as you like", "Half of it"], 0));
  if (k === "letter" && c?.what_to_do?.[0]) out.push(mk("What do you need to do first?", c.what_to_do[0], ["Nothing. Ignore the letter.", "Throw the letter away."], 1));
  if (k === "letter" && c?.by_when?.[0]) out.push(mk(`By when do you need to ${c.by_when[0].what}?`, c.by_when[0].date, ["There is no date", "Next year"], 2));
  if (k === "form" && c?.fields?.[0]) out.push(mk(`What goes in the box "${c.fields[0].label}"?`, c.fields[0].what_to_write, ["Leave it empty", "Anything you like"], 0));
  if (k === "howto" && g.steps[0]) out.push(mk("What do you do first?", g.steps[0].text, ["Skip the first steps", "Ask someone else to do it"], 1));
  const warn = g.steps.find((s) => s.kind === "warning");
  if (warn) out.push(mk("Which of these is a warning from your paper?", warn.text, ["Nothing to watch for", "You can ignore it"], 2));
  return out.slice(0, 3);
}

export function TellBack({ guide, lang, onCheck, onClose }: { guide: Guide; lang: string; onCheck: (answer: string) => void; onClose: () => void }) {
  const qs = useMemo(() => buildQuestions(guide), [guide]);
  const [qi, setQi] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const q = qs[qi];
  if (!q) {
    return (
      <div className="screen">
        <TitleBar title={t(lang, "tellBack")} lang={lang} onBack={onClose} />
        <p className="sub">{t(lang, "askExample")}</p>
        <div className="foot">
          <button className="btn" onClick={onClose}>{t(lang, "tbDone")}</button>
        </div>
      </div>
    );
  }
  const right = pick === q.correct;
  return (
    <div className="screen">
      <div className="prog">
        <button className="round" onClick={onClose} aria-label={t(lang, "close")}>
          <Icon name="x" />
        </button>
        <div className="bars">
          {qs.map((_, i) => (
            <button key={i} className={i <= qi ? "d" : ""} tabIndex={-1} aria-hidden="true" />
          ))}
        </div>
        <div className="of">
          <Counter lang={lang} n={qi + 1} total={qs.length} />
        </div>
      </div>
      <EmergencyLink lang={lang} />
      <h1 className="qtitle">{q.q}</h1>
      <div className="choices" role="radiogroup" aria-label={q.q}>
        {q.options.map((o, i) => (
          <button
            key={i}
            role="radio"
            aria-checked={pick === i}
            className={"choice" + (checked && i === q.correct ? " right" : pick === i ? " pick" : "")}
            onClick={() => !checked && setPick(i)}
          >
            <span className="pi">
              <Icon name={q.icons[i % q.icons.length]} />
            </span>
            {o}
          </button>
        ))}
      </div>
      {checked && (
        <div className={"check" + (right ? "" : " butter")} aria-live="polite">
          <Icon name={right ? "check" : "alert"} />
          {right ? t(lang, "tbRight") : `${t(lang, "tbWrong")} ${q.options[q.correct]}`}
        </div>
      )}
      <div className="foot">
        {!checked ? (
          <button
            className="btn"
            disabled={pick === null}
            onClick={() => {
              setChecked(true);
              onCheck(q.options[pick!]);
            }}
          >
            {t(lang, "tbCheck")}
          </button>
        ) : qi < qs.length - 1 ? (
          <button
            className="btn"
            onClick={() => {
              setQi(qi + 1);
              setPick(null);
              setChecked(false);
            }}
          >
            {t(lang, "tbNext")}
          </button>
        ) : (
          <button className="btn" onClick={onClose}>
            {t(lang, "tbDone")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- 10. couldn't read it ---------- */
export function ErrorScreen({ lang, title, detail, canRetry, onRetry, onNewPhoto, onUpload, onBack }: { lang: string; title: string; detail: string | null; canRetry: boolean; onRetry: () => void; onNewPhoto: () => void; onUpload: () => void; onBack: () => void }) {
  return (
    <div className="screen" role="alert">
      <div className="top">
        <button className="round" onClick={onBack} aria-label={t(lang, "back2")}>
          <Icon name="back" />
        </button>
      </div>
      <div className="center">
        <div className="sorry">
          <Icon name="camera" />
        </div>
        <h2>{title}</h2>
        <p>{t(lang, "tryAgain")}</p>
        {detail && <div className="detail">{detail}</div>}
        <div className="tips">
          <div>
            <Icon name="sun" />
            {t(lang, "tipLight")}
          </div>
          <div>
            <Icon name="frame" />
            {t(lang, "tipWhole")}
          </div>
          <div>
            <Icon name="flat" />
            {t(lang, "tipFlat")}
          </div>
        </div>
      </div>
      <div className="foot">
        {canRetry && (
          <button className="btn" onClick={onRetry}>
            {t(lang, "retry")}
          </button>
        )}
        <button className={"btn" + (canRetry ? " soft" : "")} onClick={onNewPhoto}>
          {t(lang, "takeNew")}
        </button>
        <button className="btn soft" onClick={onUpload}>
          {t(lang, "uploadInstead")}
        </button>
      </div>
    </div>
  );
}

/* ---------- 11. settings ---------- */
interface SettingsProps {
  lang: string;
  scale: number;
  rate: number;
  voice: boolean;
  onScale: (v: number) => void;
  onRate: (v: number) => void;
  onVoice: (v: boolean) => void;
  onLanguage: (c: string) => void;
  onBack: () => void;
}
export function Settings({ lang, scale, rate, voice, onScale, onRate, onVoice, onLanguage, onBack }: SettingsProps) {
  const [other, setOther] = useState(false);
  return (
    <div className="screen">
      <TitleBar title={t(lang, "settings")} lang={lang} onBack={onBack} />
      <div className="set">
        <div className="sec">
          <h3>
            {t(lang, "textSize")}
            <em>{Math.round(scale * 100)}%</em>
          </h3>
          <input className="range" type="range" min={1} max={1.4} step={0.1} value={scale} onChange={(e) => onScale(Number(e.target.value))} aria-label={t(lang, "textSize")} />
          <div className="sz">
            <span style={{ fontSize: 14 }}>A</span>
            <span style={{ fontSize: 26 }}>A</span>
          </div>
        </div>
        <div className="sec">
          <h3>
            {t(lang, "voiceSpeed")}
            <em>{rate < 0.9 ? t(lang, "slow") : rate > 1.05 ? t(lang, "quick") : t(lang, "normal")}</em>
          </h3>
          <input className="range" type="range" min={0.6} max={1.2} step={0.1} value={rate} onChange={(e) => onRate(Number(e.target.value))} aria-label={t(lang, "voiceSpeed")} />
          <div className="sz">
            <span>{t(lang, "slow")}</span>
            <span>{t(lang, "quick")}</span>
          </div>
        </div>
        <div className="sec">
          <h3>{t(lang, "language")}</h3>
          <div className="langs">
            {LANGUAGES.map((l) => (
              <button key={l.code} className={"chip" + (l.code === lang ? " on" : "")} aria-pressed={l.code === lang} onClick={() => onLanguage(l.code)}>
                {l.label}
              </button>
            ))}
            {!isPreset(lang) && (
              <button className="chip on" aria-pressed="true">
                {languageLabel(lang)}
              </button>
            )}
            <button className="chip" onClick={() => setOther(true)}>
              {t(lang, "otherLanguage")}
            </button>
          </div>
          {other && <LanguageDialog lang={lang} onClose={() => setOther(false)} onPick={(c) => { setOther(false); onLanguage(c); }} />}
          {isRtl(lang) && (
            <div className="rtlnote">
              <span>{languageLabel(lang)}</span>
              <small>{t(lang, "rtlNote")}</small>
            </div>
          )}
        </div>
        <button className="sec toggle" role="switch" aria-checked={voice} onClick={() => onVoice(!voice)}>
          <h3>{t(lang, "readAuto")}</h3>
          <span className={"tg" + (voice ? " on" : "")} />
        </button>
      </div>
    </div>
  );
}

/* ---------- dev panel + print ---------- */
export function DevPanel({ log, lang }: { log: ToolLogEntry[]; lang: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="devtoggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Counted lang={lang} k="devToggle" count={log.length} />
      </button>
      {open && (
        <div className="devpanel">
          <ol>
            {log.map((e, i) => (
              <li key={i}>
                <span className="tagd">{e.source}</span>
                <code dir="ltr">{e.tool}</code>({JSON.stringify(e.args)}) <bdi>{e.ms} ms</bdi>
                {e.say && <div className="say">{e.say}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

export function PrintSheet({ guide, lang }: { guide: Guide; lang: string }) {
  return (
    <div className="print-sheet">
      <h1>{guide.facts?.medicine ?? guide.facts?.title ?? t(lang, "sheetTitle")}</h1>
      <ol>
        {guide.steps.map((s) => (
          <li key={s.index} className={s.kind === "warning" || s.kind === "get_help" ? "warn" : ""}>
            <b>{s.index + 1}</b>
            {s.image_url && <img src={s.image_url} alt="" />}
            <span dir="auto">{s.text}</span>
          </li>
        ))}
      </ol>
      <p dir="auto">{safetyLines(guide).join(" ")}</p>
      {guide.source.is_sample && <p>{t(lang, "printSample")}</p>}
    </div>
  );
}
