"""Short technique outlines per device type: one idea per step, no doses.

Wording follows the NHS "how to use" pages in Easy Read style. Each line has `keywords`: if no
how step in a guide mentions one of them, the line is inserted (see postprocess.ensure_technique).
STATUS: drafted from NHS wording style; a pharmacist or the clip-library checker must sign off
(CHECKED_BY stays None until then). Never put a dose or a drug name in these lines.
"""

_SHAKE = ("Take the cap off your inhaler. Shake it well.", ["shake"], "a person shaking an inhaler")
_OUT = ("Breathe out gently.", ["breathe out"], "a person breathing out calmly")
_HOLD = ("Hold your breath for about 10 seconds.", ["hold your breath", "hold"], "a person holding their breath, cheeks full")
_WAIT = ("Wait about 30 seconds before your next puff.", ["wait"], "a clock with a person waiting calmly")
_LIPS = ("Put the mouthpiece in your mouth. Close your lips round it.", ["mouthpiece", "lips"],
         "a person with an inhaler mouthpiece in their mouth")
_WASH = ("Wash your hands.", ["wash"], "a person washing their hands")

TECHNIQUES = {
    "inhaler_mdi_spacer": [
        _SHAKE,
        ("Fit your inhaler into the spacer.", ["spacer"], "an inhaler fitted into a clear plastic spacer"),
        _OUT,
        ("Put the spacer mouthpiece in your mouth. Close your lips round it.", ["mouthpiece", "lips"],
         "a person with a spacer mouthpiece in their mouth"),
        ("Press your inhaler once.", ["press"], "a thumb pressing down on an inhaler in a spacer"),
        ("Breathe in slowly and deeply.", ["breathe in"], "a person breathing in slowly through a spacer"),
        _HOLD, _WAIT,
    ],
    "inhaler_mdi": [
        _SHAKE, _OUT, _LIPS,
        ("Breathe in slowly. Press your inhaler once as you start.", ["press"], "a person pressing an inhaler while breathing in"),
        _HOLD, _WAIT,
    ],
    "inhaler_dry_powder": [
        ("Open your inhaler. Do not shake it.", ["open", "do not shake"], "a person opening a dry powder inhaler"),
        ("Breathe out gently, away from the inhaler.", ["breathe out"], "a person breathing out calmly"),
        _LIPS,
        ("Breathe in hard and deeply.", ["breathe in"], "a person breathing in deeply through an inhaler"),
        _HOLD, _WAIT,
    ],
    "eye_drops": [
        _WASH,
        ("Tilt your head back. Look up.", ["tilt", "look up"], "a person tilting their head back"),
        ("Pull your lower eyelid down gently.", ["eyelid"], "a finger gently pulling down a lower eyelid"),
        ("Squeeze 1 drop into the gap. Do not touch your eye with the bottle.", ["drop"], "a drop falling from a bottle toward an eye"),
        ("Close your eye gently for a minute.", ["close your eye"], "a person with closed eyes"),
    ],
    "nasal_spray": [
        ("Blow your nose gently.", ["blow your nose"], "a person blowing their nose"),
        ("Tilt your head forward a little.", ["tilt"], "a person with their head tilted slightly forward"),
        ("Put the nozzle just inside 1 nostril.", ["nostril", "nozzle"], "a nasal spray nozzle at a nostril"),
        ("Spray and breathe in gently through your nose.", ["spray"], "a person spraying a nasal spray"),
    ],
    "cream_ointment": [
        _WASH,
        ("Squeeze out the amount your paper says.", ["squeeze"], "cream squeezed from a tube onto a fingertip"),
        ("Smooth it gently onto the skin.", ["smooth", "rub", "spread"], "a hand smoothing cream on an arm"),
        ("Wash your hands again.", ["wash your hands again", "again"], "a person washing their hands"),
    ],
}
SOURCE = "NHS how-to-use wording style (inhalers, eye drops, nasal sprays, creams); drafted, needs pharmacist sign-off"
CHECKED_BY = None


def outline(device_type: str | None) -> list[dict]:
    """[{text, keywords, picture_prompt}] for a known device type, else []."""
    return [{"text": t, "keywords": k, "picture_prompt": p} for t, k, p in TECHNIQUES.get(device_type or "", [])]


def outline_for_prompt(device_type: str | None) -> list[str]:
    return [o["text"] for o in outline(device_type)]
