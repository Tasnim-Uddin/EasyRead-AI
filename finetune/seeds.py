"""Fictional medicine fact sets for the dataset and eval. No real patient data. Held-out ids are in EVAL_IDS."""

def _f(medicine, dose, frequency, route, device, warnings, get_help):
    return {"medicine": medicine, "dose": dose, "frequency": frequency, "route": route, "device_type": device,
            "device_confidence": 0.9, "warnings": warnings, "get_help": get_help, "unreadable": []}

H999 = "If you have swelling of the face or trouble breathing, call 999."
SEEDS = [
    _f("Salbutamol 100 micrograms inhaler", "2 puffs", "when needed, up to 4 times a day", "inhaled", "inhaler_mdi",
       ["If you need it more than 3 times a week, tell your GP."], ["If it does not help and you cannot breathe, call 999."]),
    _f("Beclometasone 200 micrograms inhaler", "2 puffs", "morning and evening", "inhaled", "inhaler_mdi",
       ["Rinse your mouth after each use."], ["If your chest feels tight and your blue inhaler does not help, call 999."]),
    _f("Budesonide Turbohaler 200 micrograms", "1 puff", "twice a day", "inhaled", "inhaler_dpi",
       ["Do not shake this inhaler."], ["If you cannot breathe, call 999."]),
    _f("Hydrocortisone 1% cream", "a thin layer", "twice a day for up to 7 days", "applied to skin", "cream",
       ["Do not use on your face unless a doctor says so."], ["If your skin gets worse, see your GP."]),
    _f("Clotrimazole 1% cream", "a thin layer", "2 times a day for 2 weeks", "applied to skin", "cream",
       ["Wash your hands after using it."], ["If your skin is sore or swollen, ask your pharmacist."]),
    _f("Paracetamol 500 mg tablets", "2 tablets", "every 4 to 6 hours, no more than 8 tablets in 24 hours", "by mouth", "tablet",
       ["Do not take other medicines that contain paracetamol."], ["If you take too many, call 999."]),
    _f("Amoxicillin 500 mg capsules", "1 capsule", "3 times a day for 5 days", "by mouth", "tablet",
       ["Finish all the capsules, even if you feel better."], [H999]),
    _f("Ibuprofen 200 mg tablets", "1 tablet", "3 times a day with food", "by mouth", "tablet",
       ["Do not take if you have a stomach ulcer."], ["If you have black stools or are sick with blood, call 999."]),
    _f("Chloramphenicol 0.5% eye drops", "1 drop", "every 2 hours for 2 days, then 4 times a day", "eye", "eye_drops",
       ["Take out contact lenses first."], ["If your eye gets very red or painful, call 111."]),
    _f("Fluticasone nasal spray", "2 sprays in each nostril", "once a day", "nose", "nasal_spray",
       ["Do not spray towards the middle of your nose."], ["If your nose bleeds for more than 10 minutes, call 111."]),
    _f("Metformin 500 mg tablets", "1 tablet", "2 times a day with meals", "by mouth", "tablet",
       ["Do not drink a lot of alcohol."], ["If you are very sick or very thirsty, call 111."]),
    _f("Loratadine 10 mg tablets", "1 tablet", "once a day", "by mouth", "tablet", [], [H999]),
    _f("Ventolin Evohaler with spacer", "4 puffs", "when needed, one puff at a time", "inhaled", "inhaler_mdi_spacer",
       ["Clean the spacer once a week."], ["If you cannot speak in full sentences, call 999."]),
    _f("Emollient ointment", "a generous layer", "3 or 4 times a day", "applied to skin", "cream",
       ["Do not go near fire or flames. It burns easily."], []),
]
EVAL_IDS = [0, 3, 5, 8, 12]  # held out: never in the training set
