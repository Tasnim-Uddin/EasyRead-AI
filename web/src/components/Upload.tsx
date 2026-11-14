import { useState } from "react";
import { LANGUAGES, t } from "../i18n";

interface Props {
  lang: string;
  busy: boolean;
  onLanguage: (l: string) => void;
  onSubmit: (form: FormData) => void;
  onSample: () => void;
}

export default function Upload({ lang, busy, onLanguage, onSubmit, onSample }: Props) {
  const [doc, setDoc] = useState<File | null>(null);
  const [device, setDevice] = useState<File | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!doc) return;
    const f = new FormData();
    f.append("document", doc);
    if (device) f.append("device_photo", device);
    f.append("language", lang);
    onSubmit(f);
  }

  return (
    <form className="card upload" onSubmit={submit}>
      <h1>{t(lang, "title")}</h1>
      <p className="lead">{t(lang, "tagline")}</p>

      <label className="field">
        <span>{t(lang, "language")}</span>
        <select value={lang} onChange={(e) => onLanguage(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>{t(lang, "upload")}</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          onChange={(e) => setDoc(e.target.files?.[0] ?? null)}
        />
      </label>
      <label className="field">
        <span>{t(lang, "device")}</span>
        <input type="file" accept="image/*" onChange={(e) => setDevice(e.target.files?.[0] ?? null)} />
      </label>

      <div className="row">
        <button className="btn primary" type="submit" disabled={!doc || busy}>
          {busy ? t(lang, "working") : t(lang, "start")}
        </button>
        <button className="btn" type="button" onClick={onSample} disabled={busy}>
          {t(lang, "sample")}
        </button>
      </div>
      <p className="note">{t(lang, "noMedical")}</p>
    </form>
  );
}
