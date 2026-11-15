/** "Add a paper" bottom sheet (Figma 16a): in-app camera, photos (several at once) or a PDF file. */
import { useEffect, useRef } from "react";
import { t } from "../i18n";
import { CIcon } from "./icons";
import "./capture.css";
import "./strings";

interface AddPaperProps {
  lang: string;
  onCamera: () => void;
  onPhotos: (files: File[]) => void;
  onFile: (files: File[]) => void;
  onClose: () => void;
}

export function AddPaperSheet({ lang, onCamera, onPhotos, onFile, onClose }: AddPaperProps) {
  const photos = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const pick = (cb: (f: File[]) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (list.length) cb(list);
  };
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="add-sheet" role="dialog" aria-modal="true" aria-labelledby="add-sheet-title" onClick={(e) => e.stopPropagation()}>
        <i className="grab" />
        <h2 id="add-sheet-title">{t(lang, "capAddPaper")}</h2>
        <button className="add-opt" ref={first} onClick={onCamera}>
          <span className="ic">
            <CIcon name="camera" />
          </span>
          <span>
            <b>{t(lang, "capTakePhoto")}</b>
            <small>{t(lang, "capTakePhotoSub")}</small>
          </span>
        </button>
        <button className="add-opt" onClick={() => photos.current?.click()}>
          <span className="ic">
            <CIcon name="image" />
          </span>
          <span>
            <b>{t(lang, "capFromPhotos")}</b>
            <small>{t(lang, "capFromPhotosSub")}</small>
          </span>
        </button>
        <button className="add-opt" onClick={() => pdf.current?.click()}>
          <span className="ic">
            <CIcon name="file" />
          </span>
          <span>
            <b>{t(lang, "capChooseFile")}</b>
            <small>{t(lang, "capChooseFileSub")}</small>
          </span>
        </button>
        <button className="cap-link" onClick={onClose}>
          {t(lang, "capCancel")}
        </button>
        <input ref={photos} hidden type="file" accept="image/*" multiple onChange={pick(onPhotos)} />
        <input ref={pdf} hidden type="file" accept="application/pdf,.pdf" multiple onChange={pick(onFile)} />
      </div>
    </div>
  );
}
