import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Clip, Guide, GuideStatus, Step, ToolLogEntry } from "./types";
import { LANGUAGES, isFallback, t, tf } from "./i18n";
import { Counted, Counter, CountThen, T } from "./bidi";
import { canSpeak, findWorld, isRtl, languageLabel, languageValue, searchLanguages } from "./languages";
import Icon, { GuideFace } from "./icons";
import { claimAudio, releaseAudio, speak } from "./speech";
import type { AnamState } from "./useAnam";
import { THEMES, THEME_KEY, type Theme } from "./look";

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
  onSend?: (text: string) => boolean;
  /** Docked guide panel (on by default, `?dock=0` turns it off). */
  dock?: boolean;
  /** The guide's latest spoken line, for the dock caption. */
  caption?: string;
  /** Open the talk screen. */
  onTalk?: () => void;
  /** The avatar connection state, so the dock row can say "Connecting" or that the guide is not switched on. */
  state?: AnamState;
  /** Start the live avatar right here (in the dock), on the step the user is looking at. Never automatic. */
  onStartHere?: () => void;
  /** Guide-led: the guide is wanted (default). Hidden = plain read-aloud. */
  guideOn?: boolean;
  onHide?: () => void;
  onShow?: () => void;
  /** Stop the guide mid-sentence. */
  onPause?: () => void;
}
export const LiveContext = createContext<LiveInfo | null>(null);
/** Home and Summary shortcuts for every title bar. */
export const NavContext = createContext<{ onHome?: () => void; onSummary?: () => void }>({});
const useLive = () => {
  const c = useContext(LiveContext);
  return c && c.live ? c : null;
};
const useDock = () => {
  const c = useContext(LiveContext);
  return c && c.dock ? c : null;
};

/**
 * One panel above the bottom bar: the live avatar in a rounded video slot with its latest caption,
 * small End / mic / sound controls and the type bar. Collapses to a slim bar. When the avatar is not
 * live it is a slim "Talk to your guide" row.
 */
function GuideDock({ text, lang }: { text: string; lang: string }) {
  const info = useDock();
  if (!info) return null;
  if (!info.live) {
    // Not live: one clear "Start your guide" tap (browsers need a tap before any sound). Never starts on its own.
    const start = info.onStartHere ?? info.onTalk;
    if (!start) return null;
    const st = info.state;
    const on = info.guideOn !== false;
    const sub =
      st === "connecting" ? t(lang, "connecting") + "…" : st === "standin" ? t(lang, "talkStandin") : st === "error" ? t(lang, "talkError") : on ? t(lang, "startGuideSub") : t(lang, "talkGuideSub");
    return (
      <button className={"dock dock-slim" + (on ? " dock-start" : "")} onClick={start} disabled={st === "connecting"} aria-busy={st === "connecting"}>
        <GuideFace />
        <span className="dock-txt">
          <b>{t(lang, on ? "startGuide" : "showGuide")}</b>
          <small role={st === "standin" || st === "error" ? "status" : undefined}>{sub}</small>
        </span>
        <span className="dock-go">
          <Icon name="chevRight" />
        </span>
      </button>
    );
  }
  const caption = info.caption || text;
  return (
    <section className="dock dock-live" aria-label={t(lang, "guideSays")}>
      <div className="dock-row">
        <div className="avslot dockvid" data-avatar-slot="dock" />
        <div className="dock-cap" aria-live="polite">
          <b>{t(lang, "guideSays")}</b>
          <span dir="auto">{caption}</span>
        </div>
        <button className="icon-btn end" onClick={info.onHide ?? info.onEnd} aria-label={t(lang, "hideGuide")} title={t(lang, "hideGuide")}>
          <Icon name="x" />
        </button>
      </div>
      <div className="dock-ctl">
        {info.onPause && (
          <button type="button" className="btn quiet small" onClick={info.onPause}>
            {t(lang, "pauseGuide")}
          </button>
        )}
        {info.onHide && (
          <button type="button" className="btn quiet small" onClick={info.onHide}>
            {t(lang, "hideGuide")}
          </button>
        )}
      </div>
      <TypeBar lang={lang} onSend={info.onSend}>
        <button type="button" className="icon-btn mic" onClick={info.onToggleMic} aria-pressed={info.micMuted} aria-label={t(lang, info.micMuted ? "unmuteMic" : "muteMic")}>
          <Icon name="mic" />
        </button>
        <button type="button" className="icon-btn" onClick={info.onToggleSound} aria-pressed={info.soundOff} aria-label={t(lang, info.soundOff ? "soundOn" : "soundOff")}>
          <Icon name="volume" />
        </button>
      </TypeBar>
    </section>
  );
}

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
    // the dock slot sits in a sticky bottom bar, so it moves on the page as the user scrolls
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      mo.disconnect();
      ro?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
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
/** Typed message to the live avatar (for people who cannot or prefer not to speak). */
function TypeBar({ lang, onSend, children }: { lang: string; onSend?: (text: string) => boolean; children?: React.ReactNode }) {
  const [typed, setTyped] = useState("");
  const has = !!typed.trim();
  return (
    <form
      className="typebar"
      onSubmit={(e) => {
        e.preventDefault();
        if (onSend?.(typed)) setTyped("");
      }}
    >
      {onSend && (
        <span className="field">
          <input dir="auto" enterKeyHint="send" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t(lang, "typeToGuide")} aria-label={t(lang, "typeToGuide")} />
          {/* The send button shows once there is something to send, so the bar stays calm. */}
          {(has || !children) && (
            <button className="icon-btn send" type="submit" disabled={!has} aria-label={t(lang, "send")}>
              <Icon name="send" />
            </button>
          )}
        </span>
      )}
      {children}
    </form>
  );
}
function LiveControls({ live }: { live: LiveInfo }) {
  const { lang } = live;
  return (
    <>
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
    {live.onSend && <TypeBar lang={lang} onSend={live.onSend} />}
    </>
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
      <Icon name="globe" />
      <span className="lang-name">{current}</span>
      <Icon name="chevDown" />
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

export function TopBar({ lang, onLanguage, onSettings, onBrand, onPapers }: { lang: string; onLanguage: (c: string) => void; onSettings: () => void; onBrand?: () => void; onPapers?: () => void }) {
  return (
    <div className="top">
      <button className="brand" onClick={onBrand} disabled={!onBrand}>
        <i />
        EasyRead
      </button>
      <div className="top-right">
        <LangPill lang={lang} onLanguage={onLanguage} />
        {onPapers && (
          <button className="round" onClick={onPapers} aria-label={t(lang, "myPapers")}>
            <Icon name="history" />
          </button>
        )}
        <button className="round" onClick={onSettings} aria-label={t(lang, "settings")}>
          <Icon name="sliders" />
        </button>
      </div>
    </div>
  );
}

/** Back on the start side, the title centred, an optional control on the end side (mirrors in RTL). */
export function TitleBar({ title, lang, onBack, right }: { title: React.ReactNode; lang: string; onBack: () => void; right?: React.ReactNode }) {
  const nav = useContext(NavContext);
  return (
    <div className="title-top">
      <button className="round" onClick={onBack} aria-label={t(lang, "back2")}>
        <Icon name="back" />
      </button>
      <h1>{title}</h1>
      <div className="title-end">
        {right}
        {nav.onSummary && (
          <button className="round" onClick={nav.onSummary} aria-label={t(lang, "summaryNav")} title={t(lang, "summaryNav")}>
            <Icon name="list" />
          </button>
        )}
        {nav.onHome && (
          <button className="round" onClick={nav.onHome} aria-label={t(lang, "home")} title={t(lang, "home")}>
            <Icon name="home" />
          </button>
        )}
      </div>
    </div>
  );
}

/* Persistent 999 link: shown at the foot of every guide screen (same rule as the home screen: all document kinds). */
export function EmergencyLink({ lang, warn }: { lang: string; warn?: boolean }) {
  return (
    <a className={"sos" + (warn ? " warn" : "")} href="tel:999">
      <Icon name="phone" />
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
  /** Demo mode only: customers never see the sample chips. */
  onSample?: (name: string) => void;
  onPapers: () => void;
  hasPapers: boolean;
  /** The newest paper made on this phone (from My papers), shown as "Last paper". */
  lastPaper?: PaperRow | null;
  onOpenPaper?: (id: string) => void;
}
export function Home({ lang, onLanguage, onSettings, onCamera, onUpload, onSample, onPapers, hasPapers, lastPaper, onOpenPaper }: HomeProps) {
  return (
    <div className="screen">
      <TopBar lang={lang} onLanguage={onLanguage} onSettings={onSettings} onPapers={onPapers} />
      <div className="hero">
        <h1>
          {t(lang, "homeTitleA")} {t(lang, "homeTitleB")}
        </h1>
        <p>{t(lang, "homeLead")}</p>
        <div className="scan">
          {/* The camera circle is a big extra tap target for touch; the button below is the one for keyboards and screen readers. */}
          <div className="cam" onClick={onCamera} aria-hidden="true">
            <Icon name="camera" />
          </div>
          <span className="lbl">{t(lang, "scanHint")}</span>
          <button className="btn" onClick={onCamera}>
            <Icon name="camera" />
            {t(lang, "takePhoto")}
          </button>
        </div>
        <button className="btn soft" onClick={onUpload}>
          <Icon name="upload" />
          {t(lang, "upload")}
        </button>
        {hasPapers && lastPaper && onOpenPaper ? (
          <section className="last" aria-label={t(lang, "lastPaper")}>
            <h2 className="group">{t(lang, "lastPaper")}</h2>
            <PaperCard lang={lang} row={lastPaper} onOpen={onOpenPaper} />
          </section>
        ) : (
          hasPapers && (
            <button className="btn soft papers-link" onClick={onPapers}>
              <Icon name="history" />
              {t(lang, "myPapers")}
            </button>
          )
        )}
        <p className="help">
          <Icon name="lock" />
          {t(lang, "privateHere")}
        </p>
        {onSample && (
          <div className="samples">
            <span style={{ flexBasis: "100%", textAlign: "center" }}>{t(lang, "trySample")}</span>
            <button onClick={() => onSample("inhaler")}>{t(lang, "sampleInhaler")}</button>
            <button onClick={() => onSample("council")}>{t(lang, "sampleLetter")}</button>
            <button onClick={() => onSample("flatpack")}>{t(lang, "sampleFlatpack")}</button>
          </div>
        )}
        <EmergencyLink lang={lang} />
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
  onPapers?: () => void;
  onAdd: () => void;
  onRole: (id: number, r: Role) => void;
  onRemove: (id: number) => void;
  onMove: (id: number, d: -1 | 1) => void;
  onMake: () => void;
}
export function Tray({ lang, items, busy, tooMany, onLanguage, onSettings, onPapers, onAdd, onRole, onRemove, onMove, onMake }: TrayProps) {
  const n = items.length;
  return (
    <div className="screen">
      <TopBar lang={lang} onLanguage={onLanguage} onSettings={onSettings} onPapers={onPapers} />
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
export function Reading({ lang, status, onCancel, onRetry }: { lang: string; status: GuideStatus | "uploading"; onCancel?: () => void; onRetry?: () => void }) {
  const stage = status === "uploading" || status === "extracting" ? 0 : status === "writing" ? 1 : 2;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 90000);
    return () => clearTimeout(timer);
  }, [status]);
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
        {slow && <p role="alert">{t(lang, "readingSlow")}</p>}
      </div>
      <div className="foot">
        {slow && onRetry && (
          <button className="btn" onClick={onRetry}>
            {t(lang, "retry")}
          </button>
        )}
        {onCancel && (
          <button className="btn quiet" onClick={onCancel}>
            {t(lang, "cancel")}
          </button>
        )}
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
  onPapers?: () => void;
  onBack: () => void;
  onStart: () => void;
  onListen: () => void;
  /** The one audio tap: start the live guide, which then explains step 1. */
  onStartGuide?: () => void;
}
export function Summary({ guide, lang, onLanguage, onBack, onStart, onListen, onStartGuide }: SummaryProps) {
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
  const thumb = guide.steps.find((s) => s.image_url)?.image_url;
  return (
    <div className="screen">
      <TitleBar title={t(lang, "yourGuideTitle")} lang={lang} onBack={onBack} right={<LangPill lang={lang} onLanguage={onLanguage} />} />
      <div className="card sage this-is">
        <div className="k">{t(lang, "thisIs")}</div>
        <div className="this-row">
          {thumb && <img className="thumb" src={thumb} alt="" />}
          <div className="big" dir="auto">
            {title}
          </div>
        </div>
        {subline && <p dir="auto">{subline}</p>}
      </div>

      <DeviceCard guide={guide} lang={lang} />

      {conflicts.length > 0 && (
        <div className="card warn" role="alert">
          <div className="warn-head">
            <span className="warn-ico">
              <Icon name="alert" />
            </span>
            <div>
              <b>{t(lang, "conflictTitle")}</b>
              <p>{t(lang, "conflictAsk")}</p>
            </div>
          </div>
          {conflicts.map((x, i) => (
            <div className="quotes" key={i}>
              <div className="quote">
                <b>{t(lang, "labelSays")}</b>
                <span dir="auto">“{x.label}”</span>
              </div>
              <div className="quote">
                <b>{t(lang, "leafletSays")}</b>
                <span dir="auto">“{x.leaflet}”</span>
              </div>
            </div>
          ))}
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
      {guide.source.is_sample && k === "medicine" && <p className="safe">{t(lang, "sampleNote")}</p>}
      <p className="safe" dir="auto">
        {safetyLines(guide).map((l, i) => (
          <span key={i}>
            {l}{" "}
          </span>
        ))}
      </p>

      <div className="foot sticky">
        {onStartGuide && (
          <button className="btn start-guide" onClick={onStartGuide}>
            <GuideFace />
            {t(lang, "startWithGuide")}
          </button>
        )}
        <div className="pair">
          {canSpeak(lang) && (
            <button className="btn soft" onClick={onListen}>
              <Icon name="volume" />
              {t(lang, "listen")}
            </button>
          )}
          <button className="btn" onClick={onStart}>
            {t(lang, k === "letter" || k === "form" ? "showSteps" : "startStep")}
            <Icon name="chevRight" />
          </button>
        </div>
        <EmergencyLink lang={lang} />
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
  moved?: number | null;
  onUndoMove?: () => void;
  askOpen?: boolean;
  onAskOpen?: (open: boolean) => void;
  onAsk?: (q: string) => void;
  answer?: string | null;
  busy?: boolean;
  onCheck?: () => void;
}
export function stepHasHow(guide: Guide, step: Step, clips: Clip[]) {
  const clip = step.technique_clip_id ? clips.find((c) => c.id === step.technique_clip_id) : undefined;
  return !!clip || (kindOf(guide) !== "letter" && kindOf(guide) !== "form" && step.kind === "how");
}
export function StepScreen({ guide, index, lang, clips, onClose, onIndex, onFinish, onShowHow, moved, onUndoMove, askOpen, onAskOpen, onAsk, answer, busy, onCheck }: StepProps) {
  const live = useLive();
  const dock = !!useDock();
  const step = guide.steps[index];
  if (!step) return null;
  const total = guide.steps.length;
  const last = index >= total - 1;
  // While the guide is live it is the one voice: no separate Listen button.
  const listen = canSpeak(lang) && !live;
  const how = stepHasHow(guide, step, clips);
  return (
    <div className={"screen step-screen" + (live ? " is-live" : "")}>
      <TitleBar
        lang={lang}
        onBack={onClose}
        title={
          <>
            <T lang={lang} k="step" /> <Counter lang={lang} n={index + 1} total={total} />
          </>
        }
      />
      <div className="bars">
        {guide.steps.map((s) => (
          <button
            key={s.index}
            className={s.index <= index ? "d" : ""}
            onClick={() => onIndex(s.index)}
            aria-label={`${t(lang, "step")} ${s.index + 1}`}
            aria-current={s.index === index ? "step" : undefined}
          />
        ))}
      </div>
      {moved != null && (
        <p className="moved-note" role="status">
          <span dir={isFallback(lang, "guideMoved") ? "ltr" : undefined}>{tf(lang, "guideMoved", { n: moved })}</span>
          {onUndoMove && (
            <button className="link-btn" onClick={onUndoMove}>
              {t(lang, "undo")}
            </button>
          )}
        </p>
      )}
      <StepPicture step={step} lang={lang} />
      <div className="step" aria-live="polite" dir="auto">
        {step.text}
      </div>
      {(listen || how) && (
        <div className={"seg" + (listen && how ? "" : " one")}>
          {listen && (
            <button className="on" onClick={() => void speak(step.text, lang)}>
              <Icon name="volume" />
              {t(lang, "listen")}
            </button>
          )}
          {how && (
            <button onClick={onShowHow}>
              <Icon name="playCircle" />
              {t(lang, "showHow")}
            </button>
          )}
        </div>
      )}
      {onAskOpen && (
        <div className="step-more">
          <button className="btn surface" onClick={() => onAskOpen(true)}>
            <Icon name="chat" />
            {t(lang, "askQ")}
          </button>
          {onCheck && (
            <button className="btn quiet" onClick={onCheck}>
              <Icon name="swap" />
              {t(lang, "tellBack")}
            </button>
          )}
        </div>
      )}
      {askOpen && onAskOpen && onAsk && (
        <AskSheet lang={lang} n={index + 1} live={!!live} answer={answer ?? null} busy={!!busy} onAsk={onAsk} onClose={() => onAskOpen(false)} />
      )}
      {!dock && (
        <div className="guide">
          <GuideOrAvatar live={live} />
          <div className="bubble" dir="auto">
            <b>{t(lang, "guideSays")}</b>
            {step.say || step.text}
          </div>
          {live && <LiveControls live={live} />}
        </div>
      )}
      <div className={dock ? "bottombar" : undefined} style={dock ? undefined : { display: "contents" }}>
        <GuideDock text={step.say || step.text} lang={lang} />
        <div className="nav">
          <button className="btn quiet back" onClick={() => onIndex(index - 1)} disabled={index === 0}>
            <Icon name="back" />
            {t(lang, "back")}
          </button>
          <button className="btn next" onClick={last ? onFinish : () => onIndex(index + 1)}>
            {t(lang, last ? "finish" : "next")}
            <Icon name="chevRight" />
          </button>
        </div>
        <EmergencyLink lang={lang} warn={step.kind === "warning" || step.kind === "get_help"} />
      </div>
    </div>
  );
}

/** Ask on the step screen: type or speak; the guide (or the document answer) replies, the user stays on the step. */
function AskSheet({ lang, n, live, answer, busy, onAsk, onClose }: { lang: string; n: number; live: boolean; answer: string | null; busy: boolean; onAsk: (q: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sent, setSent] = useState(false);
  const [listening, setListening] = useState(false);
  const SR = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  const Rec = SR.SpeechRecognition ?? SR.webkitSpeechRecognition;
  const submit = (text: string) => {
    if (!text.trim()) return;
    setSent(true);
    onAsk(text);
  };
  function mic() {
    if (!Rec) return;
    const r = new Rec();
    r.lang = findWorld(lang)?.code ?? lang;
    r.interimResults = false;
    r.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const text = e.results[0][0].transcript;
      setQ(text);
      submit(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={t(lang, "askQ")} onClick={onClose}>
      <div className="ask-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <b>{t(lang, "askQ")}</b>
          <button className="round" onClick={onClose} aria-label={t(lang, "close")}>
            <Icon name="x" />
          </button>
        </div>
        <p className="sub">{tf(lang, "stillOnStep", { n })}</p>
        <textarea dir="auto" value={q} onChange={(e) => setQ(e.target.value)} rows={2} placeholder={t(lang, "askExample")} />
        <div className="sheet-actions">
          {Rec && (
            <button className="btn quiet" onClick={mic} aria-pressed={listening}>
              <Icon name="mic" />
              {listening ? t(lang, "listening") : t(lang, "speak")}
            </button>
          )}
          <button className="btn" onClick={() => submit(q)} disabled={!q.trim() || busy}>
            <Icon name="send" />
            {t(lang, "askQ")}
          </button>
        </div>
        {sent && !live && (busy ? <p role="status">…</p> : answer ? <div className="answer" dir="auto" aria-live="polite">{answer}</div> : null)}
        {sent && live && <p className="sub" role="status">{t(lang, "guideSays")}…</p>}
        <button className="btn quiet" onClick={onClose}>
          {tf(lang, "backToStep", { n })}
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
  const dock = !!useDock();
  useEffect(() => {
    if (vid.current) vid.current.playbackRate = slow ? 0.5 : 1;
  }, [slow, playing]);
  // A clip has the floor while it plays: the guide is quieted, and comes back after.
  useEffect(() => {
    if (!playing || !clip) return;
    claimAudio("clip");
    return () => releaseAudio("clip");
  }, [playing, clip]);
  if (!step) return null;
  const play = () => {
    setPlaying(true);
    if (vid.current) void vid.current.play();
    else void speak(step.text, lang);
  };
  return (
    <div className="screen">
      <TitleBar title={t(lang, "clipTitle")} lang={lang} onBack={onBack} />
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
        {!playing && clip && (
          <button className="play" onClick={play} aria-label={t(lang, "playAgain")}>
            <Icon name="play" />
          </button>
        )}
        {!clip && <p className="no-video" role="status">{t(lang, "noVideo")}</p>}
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
      <div className={dock ? "bottombar" : undefined} style={dock ? undefined : { display: "contents" }}>
        <GuideDock text={step.say || step.text} lang={lang} />
        <div className="nav">
          <button className="btn" onClick={onBack}>
            {t(lang, "close")}
          </button>
        </div>
        <EmergencyLink lang={lang} />
      </div>
    </div>
  );
}

/* ---------- 7. ask / finish ---------- */
const CHIP_KEYS: Record<Kind, string[]> = {
  medicine: ["cMed1", "cMed2", "cMed3"],
  letter: ["cLet1", "cLet2", "cLet3"],
  form: ["cForm1", "cForm2"],
  howto: ["cHow1", "cHow2"],
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
  const dock = !!useDock();
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

  const asked = answer ? question.trim() : "";
  const more = (
    <div className="ans-actions">
      <button className="btn surface" onClick={onTellBack}>
        <Icon name="swap" />
        {t(lang, "tellBack")}
      </button>
      <button className="btn quiet" onClick={onPrint}>
        <Icon name="print" />
        {t(lang, "print")}
      </button>
    </div>
  );
  return (
    <div className="screen">
      <TitleBar title={t(lang, "ask")} lang={lang} onBack={onBack} />
      <p className="sub done-line">
        <Icon name="check" />
        <span dir={isFallback(lang, "allDone") ? "ltr" : undefined}>{tf(lang, "allDone", { n: guide.steps.length })}</span>
      </p>
      {live && !dock && (
        <div className="guide">
          <GuideOrAvatar live={live} />
          <LiveControls live={live} />
        </div>
      )}
      <div className="ask">
        <h2>{heading}</h2>
        <form
          className="askbar"
          onSubmit={(e) => {
            e.preventDefault();
            onAsk();
          }}
        >
          <label className="field">
            <span className="sr">{t(lang, "askExample")}</span>
            <textarea
              ref={input}
              className="q"
              rows={1}
              dir="auto"
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
          {question.trim() && !answer ? (
            <button className="icon-btn send" type="submit" disabled={busy} aria-label={t(lang, "ask")}>
              <Icon name="send" />
            </button>
          ) : (
            <button type="button" className={"icon-btn mic" + (listening ? " on" : "")} onClick={mic} aria-label={t(lang, "tapSpeak")}>
              <Icon name="mic" />
            </button>
          )}
        </form>
        {(busy || listening) && (
          <p className="sub" role="status" style={{ padding: "0.5rem 0 0" }}>
            {busy ? t(lang, "thinking") : t(lang, "listening")}…
          </p>
        )}
      </div>
      <div className="chips" role="list">
        {CHIP_KEYS[k].map((ck) => t(lang, ck)).map((c) => (
          <button
            key={c}
            role="listitem"
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
      {answer && !(dock && live) ? (
        <section className="answer" aria-live="polite">
          <div className="ans-head">
            <GuideFace />
            <b>{t(lang, "guideSays")}</b>
            {canSpeak(lang) && (
              <button className="icon-btn surface" onClick={() => void speak(answer, lang)} aria-label={t(lang, "readAnswer")}>
                <Icon name="volume" />
              </button>
            )}
          </div>
          {asked && (
            <p className="asked" dir="auto">
              {t(lang, "youAsked")} {asked}
            </p>
          )}
          <p className="ans-text" dir="auto">
            {answer}
          </p>
          {more}
        </section>
      ) : (
        more
      )}
      <p className="safe info">
        <Icon name="info" />
        <span>
          <b>{t(lang, "notSure")}</b> {safetyLines(guide).map((l) => l.replace(/^Not sure\?\s*/, "")).join(" ")}
        </span>
      </p>
      <div className={dock ? "bottombar" : "foot"}>
        {dock && live ? (
          <GuideDock text={answer ?? t(lang, "allDoneSub")} lang={lang} />
        ) : (
          <div className="nav">
            <button className="btn next" onClick={onTalk}>
              <Icon name="chat" />
              {t(lang, "talkGuide")}
            </button>
          </div>
        )}
        <EmergencyLink lang={lang} />
      </div>
    </div>
  );
}

/* ---------- 8. talk to your guide ---------- */
interface TalkProps {
  lang: string;
  onSend?: (text: string) => boolean;
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
export function TalkScreen({ lang, state, error, sttMissing, caption, onLanguage, onBack, onStart, onStop, onType, onSend, micMuted, soundOff, onToggleMic, onToggleSound }: TalkProps) {
  const live = state === "live";
  return (
    <div className="screen talk">
      <TitleBar title="" lang={lang} onBack={onBack} right={<LangPill lang={lang} onLanguage={onLanguage} />} />
      <div className="stage">
        {!live && <GuideFace large />}
        {live && <div className="avslot" data-avatar-slot="stage" />}
        {live && (
          <>
            <span className="stage-chip live-chip">
              <i />
              {t(lang, "liveNow")}
            </span>
            <button className="stage-chip end-chip" onClick={onStop}>
              <Icon name="endCall" />
              {t(lang, "endTalk")}
            </button>
          </>
        )}
      </div>
      <div className={"live" + (caption ? "" : " empty")} aria-live="polite">
        <b>
          <i />
          {t(lang, "guideSays")}
        </b>
        <span dir="auto">{caption || t(lang, "captionEmpty")}</span>
      </div>
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
      <div className="micbig">
        {live ? (
          <>
            <button className="m" onClick={onToggleMic} aria-pressed={!!micMuted} aria-label={t(lang, micMuted ? "unmuteMic" : "muteMic")}>
              <Icon name="mic" />
            </button>
            <button className="icon-btn surface" onClick={onToggleSound} aria-pressed={!!soundOff} aria-label={t(lang, soundOff ? "soundOn" : "soundOff")}>
              <Icon name="volume" />
            </button>
          </>
        ) : (
          <>
            <button className="m" onClick={onStart} disabled={state === "connecting"} aria-label={t(lang, "startTalk")}>
              <Icon name="mic" />
            </button>
            <span>{state === "connecting" ? t(lang, "connecting") + "…" : t(lang, "startTalk")}</span>
          </>
        )}
      </div>
      <div className="foot">
        {live && onSend ? (
          <TypeBar lang={lang} onSend={onSend} />
        ) : (
          <button className="txt" onClick={onType}>
            {t(lang, "typeInstead")}
          </button>
        )}
        <EmergencyLink lang={lang} />
      </div>
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
export function buildQuestions(g: Guide, lang = "en"): Question[] {
  const T = (key: string) => t(lang, key);
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
  if (k === "medicine" && f?.frequency) out.push(mk(T("qWhen"), f.frequency, [T("dMorning"), T("dNight")].filter((x) => x !== f.frequency), 1));
  if (k === "medicine" && (f?.conflicts?.length ?? 0) > 0)
    out.push(mk(T("qConflict"), T("aPharm"), [T("dBigger"), T("dPick")], 1));
  else if (k === "medicine" && f?.dose) out.push(mk(T("qHowMuch"), f.dose, [T("dAsMuch"), T("dHalf")], 0));
  if (k === "letter" && c?.what_to_do?.[0]) out.push(mk(T("qLetterFirst"), c.what_to_do[0], [T("dIgnoreLetter"), T("dThrow")], 1));
  if (k === "letter" && c?.by_when?.[0]) out.push(mk(tf(lang, "qByWhen", { what: c.by_when[0].what }), c.by_when[0].date, [T("dNoDate"), T("dNextYear")], 2));
  if (k === "form" && c?.fields?.[0]) out.push(mk(tf(lang, "qBox", { label: c.fields[0].label }), c.fields[0].what_to_write, [T("dEmpty"), T("dAnything")], 0));
  if (k === "howto" && g.steps[0]) out.push(mk(T("qHowFirst"), g.steps[0].text, [T("dSkip"), T("dAskElse")], 1));
  const warn = g.steps.find((s) => s.kind === "warning");
  if (warn) out.push(mk(T("qWarn"), warn.text, [T("dNothing"), T("dIgnore")], 2));
  return out.slice(0, 3);
}

export function TellBack({ guide, lang, onCheck, onClose }: { guide: Guide; lang: string; onCheck: (answer: string, correct: boolean) => void; onClose: () => void }) {
  const qs = useMemo(() => buildQuestions(guide, lang), [guide, lang]);
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
      <TitleBar title={t(lang, "tellBack")} lang={lang} onBack={onClose} />
      <div className="prog">
        <div className="bars">
          {qs.map((_, i) => (
            <button key={i} className={i <= qi ? "d" : ""} tabIndex={-1} aria-hidden="true" />
          ))}
        </div>
        <div className="of">
          <Counter lang={lang} n={qi + 1} total={qs.length} />
        </div>
      </div>
      <p className="sub">{t(lang, "notATest")}</p>
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
              onCheck(q.options[pick!], pick === q.correct);
            }}
          >
            {t(lang, "tbCheck")}
          </button>
        ) : null}
        {!checked ? (
          <button className="btn quiet" onClick={onClose}>
            {t(lang, "skip")}
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
  theme?: Theme;
  onTheme?: (t: Theme) => void;
  onLanguage: (c: string) => void;
  onBack: () => void;
  demo?: boolean;
  onDemo?: (on: boolean) => void;
}
export function Settings({ lang, scale, rate, voice, theme, onScale, onRate, onVoice, onTheme, onLanguage, onBack, demo, onDemo }: SettingsProps) {
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
        {onTheme && (
          <div className="sec">
            <h3>{t(lang, "looks")}</h3>
            <div className="langs">
              {THEMES.map((th) => (
                <button key={th} className={"chip" + (th === theme ? " on" : "")} aria-pressed={th === theme} onClick={() => onTheme(th)}>
                  {t(lang, THEME_KEY[th])}
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="sec toggle" role="switch" aria-checked={voice} onClick={() => onVoice(!voice)}>
          <h3>{t(lang, "readAuto")}</h3>
          <span className={"tg" + (voice ? " on" : "")} />
        </button>
        {onDemo && (
          <button className="sec toggle demo-switch" role="switch" aria-checked={!!demo} onClick={() => onDemo(!demo)}>
            <span>
              <b>{t(lang, "demoMode")}</b>
              <small>{t(lang, "demoModeNote")}</small>
            </span>
            <span className={"tg" + (demo ? " on" : "")} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- 12. my papers (this device's guides only) ---------- */
function paperStatus(st: GuideStatus): { key: string; cls: string } {
  if (st === "ready") return { key: "paperReady", cls: "ok" };
  if (st === "failed") return { key: "paperFailed", cls: "bad" };
  return { key: "paperDrawing", cls: "wait" };
}

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Today: the time. This week: the weekday. Earlier: the date. */
function paperDate(lang: string, iso: string | null, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const age = startOfDay(now) - startOfDay(d);
  const opts: Intl.DateTimeFormatOptions =
    age <= 0 ? { hour: "numeric", minute: "2-digit" } : age < 7 * DAY ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" };
  try {
    return new Intl.DateTimeFormat(lang, opts).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/** "today" | "thisWeek" | "earlier" (the i18n keys of the group headings). */
export function paperGroup(iso: string | null, now = new Date()): "today" | "thisWeek" | "earlier" {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return "earlier";
  const age = startOfDay(now) - startOfDay(d);
  return age <= 0 ? "today" : age < 7 * DAY ? "thisWeek" : "earlier";
}

export interface PaperRow {
  id: string;
  title: string;
  language: string;
  created_at: string | null;
  status: GuideStatus;
  thumbnail: string | null;
}

/** One paper: thumbnail, title, language and date. The trash button only shows on My papers. */
function PaperCard({ lang, row, onOpen, onDelete }: { lang: string; row: PaperRow; onOpen: (id: string) => void; onDelete?: () => void }) {
  const st = paperStatus(row.status);
  const title = row.title || t(lang, "yourPaper");
  return (
    <div className="paper-card">
      <button className="open" onClick={() => onOpen(row.id)}>
        <span className="th">{row.thumbnail ? <img src={row.thumbnail} alt="" /> : <Icon name="file" />}</span>
        <span className="meta">
          <b dir="auto">{title}</b>
          <small>
            <Icon name="globe" />
            <bdi>{languageLabel(row.language)}</bdi>
            {row.created_at && (
              <>
                {" · "}
                <bdi>{paperDate(lang, row.created_at)}</bdi>
              </>
            )}
          </small>
          {row.status !== "ready" && <span className={"pstat " + st.cls}>{t(lang, st.key)}</span>}
        </span>
        {!onDelete && (
          <span className="chev">
            <Icon name="chevRight" />
          </span>
        )}
      </button>
      {onDelete && (
        <button className="icon-btn ghost" onClick={onDelete} aria-label={`${t(lang, "deletePaper")}: ${title}`}>
          <Icon name="trash" />
        </button>
      )}
    </div>
  );
}

interface PapersProps {
  lang: string;
  rows: PaperRow[] | null; // null while loading
  failed: boolean;
  onBack: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
  onNew: () => void;
}
export function MyPapers({ lang, rows, failed, onBack, onOpen, onDelete, onRetry, onNew }: PapersProps) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const groups = useMemo(() => {
    const out: { key: string; rows: PaperRow[] }[] = [];
    for (const r of rows ?? []) {
      const key = paperGroup(r.created_at);
      const g = out.find((x) => x.key === key);
      if (g) g.rows.push(r);
      else out.push({ key, rows: [r] });
    }
    return out;
  }, [rows]);
  const empty = !!rows && rows.length === 0;
  return (
    <div className="screen papers">
      <TitleBar title={t(lang, "myPapers")} lang={lang} onBack={onBack} />
      {!empty && <p className="sub">{t(lang, "papersTap")}</p>}
      {failed && (
        <div className="banner" role="alert">
          <p>{t(lang, "papersLoadFailed")}</p>
          <button className="btn soft" onClick={onRetry}>
            {t(lang, "papersRetry")}
          </button>
        </div>
      )}
      {rows === null && !failed && (
        <p className="sub" role="status">
          {t(lang, "papersLoading")}…
        </p>
      )}
      {empty && (
        <div className="papers-empty">
          <span className="empty-ico">
            <Icon name="file" />
          </span>
          <h2>{t(lang, "papersEmptyTitle")}</h2>
          <p>{t(lang, "papersEmptyText")}</p>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.key} className="pgroup" aria-label={t(lang, g.key)}>
          <h2 className="group">{t(lang, g.key)}</h2>
          <ul>
            {g.rows.map((r) => {
              const title = r.title || t(lang, "yourPaper");
              return (
                <li key={r.id}>
                  {confirm === r.id ? (
                    <div className="paper-card confirm" role="group" aria-label={t(lang, "deleteAsk")}>
                      <b>{t(lang, "deleteAsk")}</b>
                      <small dir="auto">{title}</small>
                      <div className="pair">
                        <button className="btn soft" onClick={() => setConfirm(null)}>
                          {t(lang, "deleteKeep")}
                        </button>
                        <button className="btn danger" onClick={() => { setConfirm(null); onDelete(r.id); }}>
                          <Icon name="trash" />
                          {t(lang, "deleteYes")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <PaperCard lang={lang} row={r} onOpen={onOpen} onDelete={() => setConfirm(r.id)} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {rows && rows.length > 0 && (
        <p className="help">
          <Icon name="lock" />
          {t(lang, "papersPrivate")}
        </p>
      )}
      <div className="foot sticky">
        <button className="btn" onClick={onNew}>
          <Icon name="camera" />
          {t(lang, empty ? "takePhoto" : "newPaper")}
        </button>
        <EmergencyLink lang={lang} />
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
