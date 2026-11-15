// A PDF of the summary sheet, made in the browser: the browser draws the text (so Arabic, Urdu and Bengali shape
// correctly), html2canvas turns it into a picture, jsPDF puts it on A4 pages. Both libraries load only when used.
export async function sheetPdf(el: HTMLElement, name: string): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  await document.fonts?.ready;
  // Lay the sheet out at paper proportions (not phone width) off screen, so it fills one A4 page.
  const clone = el.cloneNode(true) as HTMLElement;
  clone.classList.add("x-pdf");
  Object.assign(clone.style, { position: "fixed", left: "-10000px", top: "0", width: "720px", fontSize: "20px" });
  document.body.appendChild(clone);
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
  } finally {
    clone.remove();
  }
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 12;
  const maxW = 210 - margin * 2;
  const maxH = 297 - margin * 2;
  // One page: as wide as the page, or smaller when the sheet is long.
  const k = Math.min(maxW / canvas.width, maxH / canvas.height);
  const w = canvas.width * k;
  const h = canvas.height * k;
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (210 - w) / 2, margin, w, h);
  const blob = pdf.output("blob");
  return new File([blob], name, { type: "application/pdf" });
}

export function safeFileName(title: string): string {
  const base = title.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return (base || "easyread-guide") + ".pdf";
}

export function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
