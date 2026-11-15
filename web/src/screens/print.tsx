import type { Guide } from "../types";
import { SheetCard, useSheetOpts } from "../extras/Share";
import { paperImages } from "./papers";

/** The printed page: the same one-page summary as Save or share (with the same choices). Hidden on screen. */
export function PrintSheet({ guide, lang }: { guide: Guide; lang: string }) {
  const o = useSheetOpts();
  return (
    <div className="print-sheet">
      <SheetCard guide={guide} lang={lang} english={o.english} photo={o.photo && paperImages(guide).length > 0} print />
    </div>
  );
}
