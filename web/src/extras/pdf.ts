// A PDF of the summary sheet, made in the browser: the browser draws the text (so Arabic, Urdu and Bengali shape
// correctly), html2canvas turns it into a picture, jsPDF puts it on A4 pages. Both libraries load only when used.
export async function sheetPdf(el: HTMLElement, name: string): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  await document.fonts?.ready;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const w = pageW - margin * 2;
  const pxPerMm = canvas.width / w;
  const sliceH = Math.floor((pageH - margin * 2) * pxPerMm);
  for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
    const part = document.createElement("canvas");
    part.width = canvas.width;
    part.height = Math.min(sliceH, canvas.height - y);
    part.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, canvas.width, part.height);
    if (page > 0) pdf.addPage();
    pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, w, part.height / pxPerMm);
  }
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
