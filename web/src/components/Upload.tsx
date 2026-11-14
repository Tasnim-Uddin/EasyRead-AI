import { useRef, useState } from "react";
import { LANGUAGES, t } from "../i18n";

interface Props {
  lang: string;
  busy: boolean;
  onLanguage: (l: string) => void;
  onSubmit: (form: FormData) => void;
  onSample: () => void;
}

const MAX_FILES = 8;

export default function Upload({ lang, busy, onLanguage, onSubmit, onSample }: Props) {
  const [docs, setDocs] = useState<File[]>([]);
  const [tooMany, setTooMany] = useState(false);
  const [device, setDevice] = useState<File | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const deviceRef = useRef<HTMLInputElement>(null);

  // Several pages or documents are sent as repeated "document" fields (CONTRACTS.md §2).
  function addDocs(list: FileList | null) {
    if (!list) return;
    const next = [...docs, ...Array.from(list)];
    setTooMany(next.length > MAX_FILES);
    setDocs(next.slice(0, MAX_FILES));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (docs.length === 0) return;
    const f = new FormData();
    docs.forEach((d) => f.append("document", d));
    if (device) f.append("device_photo", device);
    f.append("language", lang);
    onSubmit(f);
  }

  return (
    <div className="hero">
      <div className="hero-copy">
        <p className="eyebrow">{t(lang, "eyebrow")}</p>
        <h1>
          {t(lang, "heroA")} <span className="accent">{t(lang, "heroB")}</span>
        </h1>
        <p className="lead">{t(lang, "tagline")}</p>
        <p className="trust">
          <span>🛡 {t(lang, "private")}</span> <span>🔊 {t(lang, "inYourLang")}</span>
        </p>
        <p className="note">{t(lang, "noMedical")}</p>
      </div>

      <form className="card upload" onSubmit={submit}>
        <h2>
          <span className="num">1</span> {t(lang, "addDoc")}
        </h2>
        <p className="note">{t(lang, "addDocHint")}</p>

        <input ref={photoRef} hidden type="file" accept="image/*" capture="environment" onChange={(e) => { addDocs(e.target.files); e.target.value = ""; }} />
        <input ref={pdfRef} hidden multiple type="file" accept="application/pdf,image/*" onChange={(e) => { addDocs(e.target.files); e.target.value = ""; }} />
        <input ref={deviceRef} hidden type="file" accept="image/*" onChange={(e) => setDevice(e.target.files?.[0] ?? null)} />

        <button type="button" className="btn primary choice" onClick={() => photoRef.current?.click()}>
          <span>📷</span>
          <span>
            <strong>{t(lang, "photo")}</strong>
            <small>{t(lang, "photoHint")}</small>
          </span>
        </button>
        <button type="button" className="btn choice" onClick={() => pdfRef.current?.click()}>
          <span>📄</span>
          <strong>{t(lang, "pdf")}</strong>
        </button>
        {docs.map((d, i) => (
          <p className="picked" key={i}>
            ✓ {d.name}{" "}
            <button type="button" className="linkbtn" aria-label={`Remove ${d.name}`} onClick={() => setDocs(docs.filter((_, j) => j !== i))}>
              ✕
            </button>
          </p>
        ))}
        {tooMany && <p className="note" role="alert">{t(lang, "tooMany")}</p>}

        <button type="button" className="devicerow" onClick={() => deviceRef.current?.click()}>
          <span>🖼</span>
          <span>
            <strong>{device ? `✓ ${device.name}` : t(lang, "device")}</strong>
            <small>{t(lang, "deviceHint")}</small>
          </span>
        </button>

        <label className="field">
          <span>🌐 {t(lang, "language")}</span>
          <select value={lang} onChange={(e) => onLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <div className="row">
          <button className="btn primary" type="submit" disabled={docs.length === 0 || busy}>
            {busy ? t(lang, "working") : t(lang, "start")}
          </button>
          <button className="btn" type="button" onClick={onSample} disabled={busy}>
            {t(lang, "sample")}
          </button>
        </div>
      </form>
    </div>
  );
}
