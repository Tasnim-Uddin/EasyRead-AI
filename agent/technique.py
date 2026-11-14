"""Short technique outlines per device type: one idea per step, no doses.

Wording was compared against NHS pages on 2026-11-14 by the team's tooling; human sign-off pending
(CHECKED_BY stays None until a pharmacist or the clip-library checker signs off). The pages used per device
are in NHS_SOURCES. nhs.uk has no step-by-step inhaler page, so the inhaler outlines follow the NHS Lothian
inhaler training guide (NHS Scotland), with the "rinse your mouth" advice from nhs.uk.
Each line has `keywords`: if no how step in a guide mentions one of them, the line is inserted (see
postprocess.ensure_technique). Never put a dose or a drug name in these lines.
"""

CHECKED_ON = "2026-11-14"

_SHAKE = ("Take the cap off your inhaler. Check the mouthpiece is clear. Shake it 4 or 5 times.", ["shake"],
          "a person shaking an inhaler")
_OUT = ("Breathe out fully and gently. Do not breathe out into the inhaler.", ["breathe out"],
        "a person breathing out calmly")
_HOLD = ("Take the inhaler out of your mouth. Hold your breath for up to 10 seconds, or as long as is comfortable.",
         ["hold your breath", "hold"], "a person holding their breath, cheeks full")
_WAIT = ("Wait at least 30 seconds before your next puff.", ["wait"], "a clock with a person waiting calmly")
_LIPS = ("Put the mouthpiece in your mouth. Close your lips round it.", ["mouthpiece", "lips"],
         "a person with an inhaler mouthpiece in their mouth")
_RINSE = ("If your inhaler has a steroid in it, rinse your mouth with water after your last puff. Spit the water out.",
          ["rinse"], "a person rinsing their mouth and spitting into a sink")
_WASH = ("Wash your hands.", ["wash"], "a person washing their hands")

TECHNIQUES = {
    "inhaler_mdi_spacer": [
        _SHAKE,
        ("Fit your inhaler into the spacer.", ["spacer"], "an inhaler fitted into a clear plastic spacer"),
        _OUT,
        ("Put the spacer mouthpiece in your mouth. Close your lips round it.", ["mouthpiece", "lips"],
         "a person with a spacer mouthpiece in their mouth"),
        ("Press your inhaler once. Breathe in slowly and gently.", ["press"],
         "a thumb pressing down on an inhaler in a spacer"),
        ("Take the spacer out of your mouth. Hold your breath for up to 10 seconds. "
         "Or keep it in and breathe in and out slowly 5 times.", ["hold your breath", "hold", "5 times"],
         "a person holding their breath, cheeks full"),
        _WAIT, _RINSE,
    ],
    "inhaler_mdi": [
        _SHAKE, _OUT, _LIPS,
        ("Breathe in slowly and gently. Press your inhaler once as you start.", ["press"],
         "a person pressing an inhaler while breathing in"),
        _HOLD, _WAIT, _RINSE,
    ],
    "inhaler_dry_powder": [
        ("Get your inhaler ready the way your leaflet shows. Do not shake it unless the leaflet says to.",
         ["open", "ready", "do not shake", "prepare"], "a person getting a dry powder inhaler ready"),
        ("Breathe out fully and gently, away from the inhaler. Never breathe out into it.", ["breathe out"],
         "a person breathing out calmly"),
        _LIPS,
        ("Breathe in with a quick, deep breath.", ["breathe in"], "a person breathing in deeply through an inhaler"),
        ("Take the inhaler out of your mouth. Hold your breath for up to 10 seconds, or as long as is comfortable.",
         ["hold your breath", "hold"], "a person holding their breath, cheeks full"),
        ("Close your inhaler. Put the cap back on.", ["close your inhaler", "cap"],
         "a person closing a dry powder inhaler"),
        _RINSE,
    ],
    "eye_drops": [
        _WASH,
        ("Tilt your head back.", ["tilt"], "a person tilting their head back"),
        ("Pull your lower eyelid down gently with a clean finger.", ["eyelid"],
         "a finger gently pulling down a lower eyelid"),
        ("Squeeze 1 drop into the gap. Do not let the bottle touch your eye.", ["drop"],
         "a drop falling from a bottle toward an eye"),
        ("Close your eye. Press a finger on the inside corner of your eye for about 1 minute.",
         ["close your eye", "inside corner"], "a person with closed eyes and a finger at the corner of one eye"),
        ("Wipe away extra liquid with a clean tissue.", ["wipe"], "a tissue wiping beside an eye"),
    ],
    "nasal_spray": [
        ("Shake the bottle. Take the cap off. If it is new, pump it until a fine mist comes out.", ["shake"],
         "a person shaking a nasal spray bottle"),
        ("Blow your nose gently.", ["blow your nose"], "a person blowing their nose"),
        ("Press a finger on the side of 1 nostril. Tilt your head forward a little.", ["finger", "tilt"],
         "a person with a finger against one nostril, head tilted slightly forward"),
        ("Keep the bottle upright. Put the nozzle in the other nostril.", ["nozzle"],
         "a nasal spray nozzle at a nostril"),
        ("Breathe in slowly through your nose. Spray as you breathe in.", ["spray"],
         "a person spraying a nasal spray"),
        ("Breathe out through your mouth. Do the other nostril the same way.", ["breathe out", "other nostril"],
         "a person breathing out through their mouth"),
        ("Wipe the nozzle with a clean tissue. Put the cap back on.", ["wipe"],
         "a tissue wiping a nasal spray nozzle"),
    ],
    "cream_ointment": [
        _WASH,
        ("Squeeze a little onto the end of your finger. Use enough for a thin layer over the skin.", ["squeeze"],
         "cream squeezed from a tube onto a fingertip"),
        ("Rub it in gently until it disappears.", ["smooth", "rub", "spread"], "a hand smoothing cream on an arm"),
        ("Wash your hands again, unless the cream is on your hands.", ["wash your hands again", "again"],
         "a person washing their hands"),
    ],
}

_LOTHIAN = "https://services.nhslothian.scot/respiratory/wp-content/uploads/sites/30/2024/01/NHS-Lothian-Inhaler-Training-Guide-Dec-2023.pdf"
_NHS_RINSE = "https://www.nhs.uk/medicines/fluticasone-inhalers/"

# Source pages per device type, and the date the wording was compared against them.
NHS_SOURCES = {
    "inhaler_mdi_spacer": {"urls": [_LOTHIAN, _NHS_RINSE], "checked_on": CHECKED_ON},
    "inhaler_mdi": {"urls": [_LOTHIAN, _NHS_RINSE], "checked_on": CHECKED_ON},
    "inhaler_dry_powder": {"urls": [_LOTHIAN, _NHS_RINSE], "checked_on": CHECKED_ON},
    "eye_drops": {"urls": ["https://www.nhs.uk/medicines/latanoprost/how-and-when-to-use-latanoprost/",
                           "https://www.nhs.uk/medicines/chloramphenicol/how-and-when-to-use-chloramphenicol/"],
                  "checked_on": CHECKED_ON},
    "nasal_spray": {"urls": ["https://www.nhs.uk/medicines/beclometasone-nasal-spray/",
                             "https://www.nhs.uk/medicines/mometasone-nasal-spray/how-and-when-to-use-mometasone-nasal-spray/"],
                    "checked_on": CHECKED_ON},
    "cream_ointment": {"urls": ["https://www.nhs.uk/medicines/hydrocortisone-for-skin/how-and-when-to-use-hydrocortisone-for-skin/"],
                       "checked_on": CHECKED_ON},
}
SOURCE = "NHS pages listed in NHS_SOURCES, compared 2026-11-14 by the team's tooling; human sign-off pending"
CHECKED_BY = None


def outline(device_type: str | None) -> list[dict]:
    """[{text, keywords, picture_prompt}] for a known device type, else []."""
    return [{"text": t, "keywords": k, "picture_prompt": p} for t, k, p in TECHNIQUES.get(device_type or "", [])]


def outline_for_prompt(device_type: str | None) -> list[str]:
    return [o["text"] for o in outline(device_type)]


def sources(device_type: str | None) -> dict:
    """{urls, checked_on, checked_by} for a device type (serialisable); empty urls if unknown."""
    src = NHS_SOURCES.get(device_type or "", {"urls": [], "checked_on": None})
    return {**src, "checked_by": CHECKED_BY}
