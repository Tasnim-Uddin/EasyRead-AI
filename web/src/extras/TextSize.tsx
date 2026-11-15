import { t, tf } from "../i18n";
import { XIcon } from "./icons";
import "./strings";
import "./extras.css";

/** The 5 text sizes (the --scale setting). */
export const SIZES = [1, 1.1, 1.2, 1.3, 1.45];
const NAMES = ["xSizeNormal", "xSizeBig", "xSizeBigger", "xSizeBigger", "xSizeBiggest"];
export const sizeIndex = (scale: number) => SIZES.reduce((best, s, i) => (Math.abs(s - scale) < Math.abs(SIZES[best] - scale) ? i : best), 0);

/** 28a: A- / A+ with five stops and a live preview (the whole app resizes as you go). */
export function TextSizeControl({ lang, scale, onScale, preview }: { lang: string; scale: number; onScale: (v: number) => void; preview?: { title: string; text: string } }) {
  const i = sizeIndex(scale);
  const set = (n: number) => onScale(SIZES[Math.max(0, Math.min(SIZES.length - 1, n))]);
  return (
    <div className="x-textsize">
      <div className="x-preview" aria-hidden="true">
        <small>{t(lang, "xPreview")}</small>
        <b dir="auto">{preview?.title ?? t(lang, "xPreviewTitle")}</b>
        <p dir="auto">{preview?.text ?? t(lang, "xPreviewText")}</p>
      </div>
      <div className="x-size-row">
        <button dir="ltr" className="x-a minus" onClick={() => set(i - 1)} disabled={i === 0} aria-label={t(lang, "xSmaller")}>
          A−
        </button>
        <div className="x-stops" role="radiogroup" aria-label={t(lang, "textSize")}>
          <span className="x-track" aria-hidden="true">
            <span className="fill" style={{ ["--p" as string]: `${(i / (SIZES.length - 1)) * 100}%` }} />
          </span>
          {SIZES.map((s, n) => (
            <button
              key={s}
              role="radio"
              aria-checked={n === i}
              aria-label={tf(lang, "xSizeOf", { n: n + 1, total: SIZES.length })}
              className={"x-stop" + (n === i ? " on" : n < i ? " past" : "")}
              onClick={() => set(n)}
            />
          ))}
        </div>
        <button dir="ltr" className="x-a plus" onClick={() => set(i + 1)} disabled={i === SIZES.length - 1} aria-label={t(lang, "xBigger")}>
          A+
        </button>
      </div>
      <p className="x-size-name" aria-live="polite">
        {tf(lang, "xSizeOf", { n: i + 1, total: SIZES.length })} · {t(lang, NAMES[i])}
      </p>
      {i !== 0 && (
        <button className="x-link" onClick={() => set(0)}>
          {t(lang, "xNormalSize")}
        </button>
      )}
    </div>
  );
}

/** 28a as a bottom sheet (from the guide controls or Settings). */
export function TextSizeSheet({ lang, scale, onScale, onClose, preview }: { lang: string; scale: number; onScale: (v: number) => void; onClose: () => void; preview?: { title: string; text: string } }) {
  return (
    <div className="x-scrim" onClick={onClose}>
      <div className="x-sheet" role="dialog" aria-modal="true" aria-label={t(lang, "textSize")} onClick={(e) => e.stopPropagation()}>
        <span className="x-grab" aria-hidden="true" />
        <div className="x-sheet-head">
          <span className="x-ico-round aa">Aa</span>
          <h2>{t(lang, "textSize")}</h2>
          <button className="round x-close" onClick={onClose} aria-label={t(lang, "close")}>
            <XIcon name="x" />
          </button>
        </div>
        <TextSizeControl lang={lang} scale={scale} onScale={onScale} preview={preview} />
        <button className="btn x-mt" onClick={onClose}>
          <XIcon name="check" />
          {t(lang, "xDone")}
        </button>
      </div>
    </div>
  );
}
