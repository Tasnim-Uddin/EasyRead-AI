import { useEffect } from "react";
import type { Guide } from "../types";
import { t } from "../i18n";
import Icon from "../icons";

/* ---------- 14a-f my guides: web/src/extras/MyGuides.tsx ---------- */
export type { GuideRow as PaperRow } from "../extras/guides";
export { groupOf as paperGroup } from "../extras/guides";
export { MyGuides as MyPapers, RecentGuides } from "../extras/MyGuides";

/** The pictures of the user's own paper: uploads from the server, or the sample's input images. */
const SAMPLE_INPUTS: Record<string, string[]> = {
  inhaler: ["/samples/inhaler_label.png", "/samples/inhaler_leaflet.png", "/samples/inhaler_device.png"],
  council_letter: ["/samples/council_letter.png"],
  flatpack: ["/samples/flatpack.png"],
};
export function paperImages(g: Guide): string[] {
  const src = g.source;
  const urls = [...(src.documents ?? []).map((d) => d.image_url), ...(src.image_urls ?? []), src.device_photo_url ?? null].filter(
    (u): u is string => !!u,
  );
  if (urls.length) return Array.from(new Set(urls));
  const m = g.id.match(/^g_sample_(inhaler|council_letter|flatpack)/);
  return m ? SAMPLE_INPUTS[m[1]] : [];
}
export function PaperViewer({ lang, urls, onClose }: { lang: string; urls: string[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="paper-viewer" role="dialog" aria-modal="true" aria-label={t(lang, "seePaper")}>
      <div className="pv-head">
        <b>{t(lang, "seePaper")}</b>
        <button className="round" onClick={onClose} aria-label={t(lang, "close")}>
          <Icon name="x" />
        </button>
      </div>
      <div className="pv-body">
        {urls.map((u) => (
          <img key={u} src={u} alt="" />
        ))}
      </div>
    </div>
  );
}

