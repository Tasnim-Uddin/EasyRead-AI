/**
 * Corner editor (Figma 03, 03b, 03c, 03d). Four draggable dots on the photo; while one is dragged a round loupe
 * above the finger shows the corner up close. First guess: the live outline or the in-browser detector (instant);
 * then the server's OpenCV corners (POST /api/scan) replace it unless the user has already moved a dot.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ScanResult } from "../types";
import { t, tf } from "../i18n";
import type { Pt, Quad } from "./detect";
import { loadImage, quickDetect, rotateFile, scanPhoto } from "./image";
import { CIcon } from "./icons";
import { FULL, maxShift, moveCorner, rotateCw, usable } from "./quad";
import "./capture.css";
import "./strings";

export interface Cropped {
  file: File;
  url: string;
  quad: Quad;
  quality: ScanResult["quality"] | null;
}

interface CropProps {
  lang: string;
  file: File;
  url: string;
  guess?: Quad | null;
  /** Pages already added, for the strip at the bottom. */
  pages: { url: string | null }[];
  onUse: (c: Cropped, more: boolean) => void;
  onRetake: () => void;
  onBack: () => void;
}

const CORNER_KEYS = ["cornerTL", "cornerTR", "cornerBR", "cornerBL"];
const LOUPE = 116; // px
const ZOOM = 2.5;

export function CropScreen({ lang, file: file0, url: url0, guess, pages, onUse, onRetake, onBack }: CropProps) {
  const [file, setFile] = useState(file0);
  const [url, setUrl] = useState(url0);
  const [nat, setNat] = useState<[number, number] | null>(null);
  const [quad, setQuad] = useState<Quad>(guess ?? FULL);
  const [found, setFound] = useState<boolean | null>(guess ? true : null); // null: still looking
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [edited, setEdited] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const editedRef = useRef(false);
  editedRef.current = edited;
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<[number, number]>([340, 380]);
  const scanReq = useRef<Promise<ScanResult | null> | null>(null);

  // Instant guess in the browser, then the server's corners and the photo check.
  useEffect(() => {
    let gone = false;
    const ac = new AbortController();
    loadImage(url)
      .then((img) => {
        if (gone) return;
        setNat([img.naturalWidth, img.naturalHeight]);
        if (!guess && !editedRef.current) {
          const q = quickDetect(img);
          if (q) {
            setQuad(q);
            setFound(true);
          }
        }
      })
      .catch(() => undefined);
    const req = scanPhoto(file, undefined, ac.signal)
      .then((r) => {
        if (gone) return r;
        setScan(r);
        if (!editedRef.current) {
          setQuad(r.found ? (r.quad as Quad) : FULL);
          setFound(r.found);
        }
        return r;
      })
      .catch(() => {
        if (!gone) setFound((f) => f ?? false);
        return null;
      });
    scanReq.current = req;
    return () => {
      gone = true;
      ac.abort();
    };
    // A new file (rotation) starts again; the guess only counts for the first one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage([el.clientWidth, el.clientHeight]));
    ro.observe(el);
    setStage([el.clientWidth, el.clientHeight]);
    return () => ro.disconnect();
  }, []);

  // The photo fitted inside the stage.
  const [nw, nh] = nat ?? [3, 4];
  const k = Math.min(stage[0] / nw, stage[1] / nh);
  const bw = Math.max(1, nw * k), bh = Math.max(1, nh * k);
  const px = (p: Pt): Pt => [p[0] * bw, p[1] * bh];

  /* ---- dragging ---- */
  const dragStart = useRef<{ x: number; y: number; q: Pt } | null>(null);
  function onDown(i: number, e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, q: quad[i] };
    setDrag(i);
  }
  function onMove(i: number, e: React.PointerEvent) {
    const s = dragStart.current;
    if (drag !== i || !s) return;
    setQuad((q) => moveCorner(q, i, [s.q[0] + (e.clientX - s.x) / bw, s.q[1] + (e.clientY - s.y) / bh]));
  }
  function onUp() {
    if (drag === null) return;
    dragStart.current = null;
    setDrag(null);
    setEdited(true);
  }
  function onKey(i: number, e: React.KeyboardEvent) {
    const step = e.shiftKey ? 0.02 : 0.005;
    const d: Record<string, Pt> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    setQuad((q) => moveCorner(q, i, [q[i][0] + v[0], q[i][1] + v[1]]));
    setEdited(true);
  }

  async function rotate() {
    const f = await rotateFile(file);
    if (f === file) return;
    setQuad((q) => rotateCw(q));
    setScan((s) => (s ? { ...s, quad: rotateCw(s.quad as Quad) } : s));
    setNat(null);
    setUrl(URL.createObjectURL(f));
    // The rotated photo is scanned again (corners and quality on the new pixels); a moved dot is kept.
    setFile(f);
  }

  function autoAgain() {
    setEdited(false);
    if (scan) {
      setQuad(scan.found ? (scan.quad as Quad) : FULL);
      setFound(scan.found);
    }
  }

  async function use(q: Quad, more = false) {
    if (busy) return;
    setBusy(true);
    try {
      let s = scan ?? (await scanReq.current) ?? null;
      // Quality is measured inside the corners the user chose when they differ from the server's.
      if (s && maxShift(q, s.quad as Quad) > 0.02) {
        try {
          s = await scanPhoto(file, q);
        } catch {
          /* keep the first check */
        }
      }
      onUse({ file, url, quad: q, quality: s?.quality ?? null }, more);
    } finally {
      setBusy(false);
    }
  }

  const none = found === false && !edited;
  const [title, sub] =
    drag !== null
      ? ["cropNoneTitle", "cropDragSub"]
      : edited
        ? ["cropSetTitle", "cropSetSub"]
        : none
          ? ["cropNoneTitle", "cropNoneSub"]
          : ["cropTitle", found === null ? "cropFinding" : "cropSub"];
  const ok = usable(quad);
  const pts = quad.map(px);
  const n = pages.length + 1;
  const dp = drag !== null ? pts[drag] : null;
  const loupeAbove = dp ? dp[1] > LOUPE + 24 : true;

  return (
    <div className="screen cap-screen crop-screen" onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="cap-head">
        <h1 className="cap-h1">{t(lang, title)}</h1>
        <p className="cap-sub" aria-live="polite">{t(lang, sub)}</p>
      </div>
      <div className="crop-stage" ref={stageRef}>
        <div className="crop-photo" style={{ width: bw, height: bh }}>
          {nat && <img src={url} alt="" draggable={false} />}
          <svg className="crop-lines" width={bw} height={bh} aria-hidden="true">
            <polygon points={pts.map((p) => p.join(",")).join(" ")} className={ok ? "" : "bad"} />
          </svg>
          {pts.map(([x, y], i) => (
            <button
              key={i}
              className={"crop-dot" + (drag === i ? " on" : "")}
              style={{ left: x, top: y }}
              aria-label={t(lang, CORNER_KEYS[i])}
              onPointerDown={(e) => onDown(i, e)}
              onPointerMove={(e) => onMove(i, e)}
              onPointerUp={onUp}
              onKeyDown={(e) => onKey(i, e)}
            >
              <i />
            </button>
          ))}
          {dp && nat && (
            <div
              className="crop-loupe"
              aria-hidden="true"
              style={{
                left: dp[0] - LOUPE / 2,
                top: loupeAbove ? dp[1] - LOUPE - 34 : dp[1] + 34,
                backgroundImage: `url(${url})`,
                backgroundSize: `${bw * ZOOM}px ${bh * ZOOM}px`,
                backgroundPosition: `${LOUPE / 2 - dp[0] * ZOOM}px ${LOUPE / 2 - dp[1] * ZOOM}px`,
              }}
            >
              <i className="h" />
              <i className="v" />
              <b />
            </div>
          )}
          {drag === null && (
            <span className={"crop-chip" + (edited ? " set" : "")}>
              <CIcon name={edited ? "check" : "move"} size={18} />
              {t(lang, edited ? "cornersSet" : "dragDots")}
            </span>
          )}
        </div>
      </div>
      <div className="cap-row2">
        <button className="btn cap-ghost" onClick={() => void rotate()}>
          <CIcon name="rotate" />
          {t(lang, "rotate")}
        </button>
        <button className="btn cap-ghost" onClick={onRetake}>
          <CIcon name="camera" />
          {t(lang, "retakeShort")}
        </button>
      </div>
      <div className="crop-pages">
        <span className="lbl">{t(lang, "pagesLabel")}</span>
        <div className="strip">
          {pages.map((p, i) => (
            <span className="pg" key={i}>
              {p.url ? <img src={p.url} alt="" /> : <CIcon name="file" />}
              <b>{i + 1}</b>
            </span>
          ))}
          <span className="pg cur">
            {nat ? <img src={url} alt="" /> : null}
            <b>{n}</b>
          </span>
          <button className="pg add" onClick={() => void use(quad, true)} disabled={!ok || busy} aria-label={t(lang, "addPage")}>
            <CIcon name="plus" />
          </button>
          {edited ? (
            <button className="auto-again" onClick={autoAgain} disabled={!scan}>
              <CIcon name="corners" size={18} />
              {t(lang, "autoAgain")}
            </button>
          ) : (
            <span className="count">{n === 1 ? t(lang, "camOnePage") : tf(lang, "camPages", { n })}</span>
          )}
        </div>
      </div>
      <div className="cap-foot">
        {none ? (
          <div className="cap-row2 tight">
            <button className="btn cap-ghost" onClick={() => void use(FULL)} disabled={busy}>
              <CIcon name="image" />
              {t(lang, "useWhole")}
            </button>
            <button className="btn" onClick={autoAgain} disabled={!scan}>
              <CIcon name="corners" />
              {t(lang, "tryDetect")}
            </button>
          </div>
        ) : (
          <button className="btn" onClick={() => void use(quad)} disabled={!ok || busy}>
            <CIcon name="check" />
            {t(lang, "useThisPhoto")}
          </button>
        )}
        <button className="cap-link" onClick={onBack}>
          {t(lang, "capCancel")}
        </button>
      </div>
    </div>
  );
}
