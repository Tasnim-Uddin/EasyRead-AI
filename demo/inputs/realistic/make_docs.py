"""Make fictional, realistic test documents (no real patient data)."""
import pathlib, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

REPO = pathlib.Path("/home/tasnim-uddin-syed/university/personal/HCA/HCA-GenAI/.claude/worktrees/agent-a7be626a8a9bf1bb7")
OUT = pathlib.Path(__file__).parent / "realdocs"
OUT.mkdir(exist_ok=True)
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
random.seed(1)


def font(n, bold=False):
    return ImageFont.truetype(FB if bold else F, n)


def text_page(lines, w=1240, size=26, pad=70, bg="white"):
    h = pad * 2 + sum(int((s or size) * 1.6) for _, s, _ in lines)
    im = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(im)
    y = pad
    for t, s, b in lines:
        s = s or size
        d.text((pad, y), t, fill="black", font=font(s, b))
        y += int(s * 1.6)
    return im


def L(t, s=None, b=False):
    return (t, s, b)


def phone_photo(im, angle=7, blur=1.2, dim=1.0, shadow=True):
    im = im.convert("RGB")
    w, h = im.size
    # perspective-ish: keystone via quad transform onto a table
    pad = int(w * 0.12)
    canvas = Image.new("RGB", (w + 2 * pad, h + 2 * pad), (120, 100, 80))
    canvas.paste(im, (pad, pad))
    W, H = canvas.size
    k = int(w * 0.05)
    canvas = canvas.transform((W, H), Image.QUAD, (k, 0, 0, H, W, H, W - k, 0), Image.BICUBIC)
    canvas = canvas.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=(110, 90, 70))
    # uneven lighting: gradient + shadow
    g = Image.linear_gradient("L").resize(canvas.size).rotate(30)
    light = Image.new("RGB", canvas.size, (0, 0, 0))
    canvas = Image.composite(canvas, ImageEnhance.Brightness(canvas).enhance(0.6), g)
    if shadow:
        m = Image.new("L", canvas.size, 0)
        dm = ImageDraw.Draw(m)
        dm.ellipse((-canvas.size[0] // 3, canvas.size[1] // 2, canvas.size[0] // 2, canvas.size[1] * 3 // 2), fill=130)
        m = m.filter(ImageFilter.GaussianBlur(60))
        canvas = Image.composite(light, canvas, m)
    canvas = canvas.filter(ImageFilter.GaussianBlur(blur))
    if dim != 1.0:
        canvas = ImageEnhance.Brightness(canvas).enhance(dim)
        canvas = ImageEnhance.Contrast(canvas).enhance(0.45)
    canvas.thumbnail((1600, 1600))
    return canvas


# a. council letter phone photo
phone_photo(Image.open(REPO / "demo/inputs/council_letter.png")).save(OUT / "a_council_photo.jpg", quality=70)
# b. dim inhaler label
phone_photo(Image.open(REPO / "demo/inputs/inhaler_label.png"), angle=-4, blur=1.5, dim=0.55, shadow=False).save(OUT / "b_inhaler_dim.jpg", quality=65)


# c. 2-page text PDF (hand-written PDF)
def pdf(pages, path):
    objs = []
    def add(b):
        objs.append(b)
        return len(objs)
    font_id = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    pages_id = len(objs) + 1 + 2 * len(pages)
    page_ids = []
    for lines in pages:
        ops = ["BT /F1 12 Tf 60 780 Td 16 TL"]
        for ln in lines:
            esc = ln.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            ops.append(f"({esc}) Tj T*")
        ops.append("ET")
        stream = "\n".join(ops).encode("cp1252")
        cid = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        page_ids.append(add(b"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 595 842] /Contents %d 0 R /Resources << /Font << /F1 %d 0 R >> >> >>" % (pages_id, cid, font_id)))
    kids = " ".join(f"{i} 0 R" for i in page_ids).encode()
    assert add(b"<< /Type /Pages /Kids [" + kids + b"] /Count %d >>" % len(pages)) == pages_id
    cat = add(b"<< /Type /Catalog /Pages %d 0 R >>" % pages_id)
    out = bytearray(b"%PDF-1.4\n")
    offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for o in offs:
        out += b"%010d 00000 n \n" % o
    out += b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, cat, x)
    path.write_bytes(bytes(out))


pdf([[
    "Riverside Health Centre (FICTIONAL - SAMPLE)", "14 Mill Lane, Northbrook, NB4 2QT    Tel: 01632 960 123", "",
    "Ms Ada Sample", "22 Example Road", "Northbrook NB3 9ZZ", "", "Date: 3 November 2026", "NHS number: 000 000 0000 (sample)", "",
    "Dear Ms Sample,", "", "Appointment for a blood test and diabetes review",
    "", "We have booked an appointment for you with Nurse Patel.",
    "Date: Tuesday 1 December 2026", "Time: 8:40am", "Place: Room 4, first floor, Riverside Health Centre.",
    "Please arrive 10 minutes early and check in at the front desk.", "",
    "Fasting: Do not eat anything for 10 hours before your blood test.", "You may drink plain water. Do not drink tea, coffee or juice.",
    "Take your usual medicines unless your doctor told you not to.", "", "Continued overleaf.",
], [
    "Riverside Health Centre - page 2 of 2", "", "Please bring:",
    "- a list of all the medicines you take", "- your blood glucose meter and diary", "- a urine sample in the pot we gave you",
    "", "If you cannot come:", "Please call us on 01632 960 123 at least 24 hours before your appointment,",
    "or cancel online with the NHS App. Missed appointments waste time for other patients.",
    "", "If you feel very unwell before your appointment, call 111. In an emergency call 999.", "",
    "Yours sincerely,", "Dr R. Okafor, GP", "This is a fictional sample letter.",
]], OUT / "c_gp_letter.pdf")

# d. eye drops label
lab = text_page([
    L("Northbrook Pharmacy  01632 960 777", 22), L("CHLORAMPHENICOL 0.5% W/V EYE DROPS 10ml", 30, True),
    L("Instil ONE drop into BOTH eyes FOUR times a day", 26, True), L("for 5 days.", 26, True),
    L("Discard 28 days after opening.", 24), L("Store in a fridge 2-8°C.", 24), L("Do not wear contact lenses while using.", 24),
    L("Ms Ada Sample (FICTIONAL)        12 Nov 2026", 22), L("Keep out of the reach and sight of children.", 20),
], w=1100, bg=(250, 250, 238))
phone_photo(lab, angle=-3, blur=0.8).save(OUT / "d_eyedrops_label.jpg", quality=80)

# e. dense discharge letter
e_lines = [L("Northbrook General Hospital - Discharge Summary (FICTIONAL SAMPLE)", 26, True),
           L("Patient: Mr Ben Example   DOB: 01/01/1950   Ward: Elm   Discharged: 10/11/2026", 20),
           L("Diagnosis: Community-acquired pneumonia; atrial fibrillation (new).", 20), L("", 20),
           L("MEDICATION CHANGES", 22, True),
           L("STOP: Aspirin 75mg once daily (replaced by apixaban).", 20),
           L("START: Apixaban 5mg twice daily (morning and evening). Continue long term.", 20),
           L("START: Bisoprolol 2.5mg once daily in the morning.", 20),
           L("START: Amoxicillin 500mg three times a day for 5 more days (last dose 15/11/2026).", 20),
           L("CHANGED: Ramipril reduced from 10mg to 5mg once daily.", 20),
           L("CONTINUE: Metformin 500mg twice daily with meals.", 20),
           L("CONTINUE: Atorvastatin 20mg once daily at night.", 20),
           L("CONTINUE: Omeprazole 20mg once daily before breakfast.", 20), L("", 20),
           L("FOLLOW-UP", 22, True),
           L("GP: blood test (kidney function) in 2 weeks. Please book with your GP surgery.", 20),
           L("Cardiology clinic: letter will be sent with the date.", 20),
           L("Chest X-ray in 6 weeks to check the pneumonia has cleared.", 20), L("", 20),
           L("Seek help: if you have chest pain, are short of breath, or notice blood in urine or black stools,", 20),
           L("call 999 or go to A&E. For other concerns call 111.", 20),
           L("Discharging doctor: Dr S. Mensah (FY2). This document is fictional.", 18)]
text_page(e_lines, w=1300).save(OUT / "e_discharge.png")

# f. Spanish school letter
text_page([L("Colegio Público Los Almendros (FICTICIO)", 28, True), L("Calle Ejemplo 5, Northbrook", 20), L("", 20),
           L("Estimadas familias:", 24),
           L("El viernes 4 de diciembre de 2026 haremos una excursión al Museo de Ciencias.", 22),
           L("Salida del colegio: 9:15. Regreso: 15:30.", 22),
           L("El precio es de £8 por alumno. Pague en la oficina antes del lunes 30 de noviembre.", 22),
           L("Firme y devuelva la autorización antes del lunes 30 de noviembre.", 22),
           L("Su hijo o hija debe traer comida, agua y un abrigo.", 22),
           L("Si su hijo tiene alergias, díganoslo antes de la excursión.", 22),
           L("Atentamente, Sra. García, directora", 22), L("Carta ficticia de ejemplo.", 18)], w=1300).save(OUT / "f_spanish_school.png")

# g. not a document
Image.open(REPO / "demo/fixtures/img/council_step_0.jpg").convert("RGB").save(OUT / "g_not_document.jpg", quality=85)

# h1. utility bill
text_page([L("NorthPower Energy (FICTIONAL)", 30, True), L("Electricity bill    Account no: 1234 5678 (sample)", 22),
           L("Bill date: 6 November 2026    Period: 1 Oct 2026 - 31 Oct 2026", 22), L("", 20),
           L("Previous balance                         £0.00", 22), L("Electricity used: 212 kWh x 24.5p      £51.94", 22),
           L("Standing charge: 31 days x 53.7p        £16.65", 22), L("VAT at 5%                                £3.43", 22),
           L("TOTAL TO PAY                            £72.02", 26, True), L("", 20),
           L("Please pay by 27 November 2026.", 24, True),
           L("Pay online at northpower.example, by phone 0300 000 0000, or set up a Direct Debit (form enclosed).", 20),
           L("Struggling to pay? Call us on 0300 000 0001. We can help.", 20),
           L("If you do not pay, we may add a late payment fee of £10.", 20)], w=1300).save(OUT / "h1_bill.png")

# h2. direct debit form
im = text_page([L("Instruction to your bank or building society to pay by Direct Debit (FICTIONAL)", 24, True), L("", 20),
                L("1. Name(s) of account holder(s): ______________________________", 22), L("", 18),
                L("2. Bank/building society account number: [ ][ ][ ][ ][ ][ ][ ][ ]", 22), L("", 18),
                L("3. Branch sort code: [ ][ ] - [ ][ ] - [ ][ ]", 22), L("", 18),
                L("4. Name and full postal address of your bank or building society: ____________", 22), L("", 18),
                L("5. Reference (from your bill): 1234 5678", 22), L("", 18),
                L("6. Signature(s): _____________________   Date: ___________", 22), L("", 18),
                L("Service user number: 999999 (sample). Banks may not accept Direct Debits for some types of account.", 18)],
               w=1300)
im.save(OUT / "h2_dd_form.png")

# i. nearly unreadable crop
src = Image.open(REPO / "demo/inputs/inhaler_label.png").convert("RGB")
w, h = src.size
c = src.crop((int(w * 0.1), int(h * 0.3), int(w * 0.5), int(h * 0.55))).resize((90, 40)).filter(ImageFilter.GaussianBlur(2))
c = ImageEnhance.Brightness(c).enhance(0.5)
c.save(OUT / "i_unreadable.jpg", quality=30)
for p in sorted(OUT.iterdir()):
    print(p.name, p.stat().st_size)
