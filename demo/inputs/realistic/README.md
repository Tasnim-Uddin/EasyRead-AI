# Realistic test papers (all fictional)

Made with `make_docs.py` to test the real upload path on messy input. No real people or patient data.

| File | What it tests | Expected |
|---|---|---|
| a_council_photo.jpg | council letter photographed at an angle, blur, shadow | amounts and date exact |
| b_inhaler_dim.jpg | dim, low-contrast medicine label | reads dose; no spacer unless the label says always |
| c_gp_letter.pdf | 2-page GP appointment letter (PDF) | date, time, room, fasting incl. "you may drink water"; the letter's own 999/111 line kept as printed |
| d_eyedrops_label.jpg | eye drops label | 1 drop, both eyes, 4 times a day, 5 days, discard after 28 days |
| e_discharge.png | dense hospital discharge letter | one step per medicine change, follow-ups kept |
| f_spanish_school.png | Spanish school letter | guide in the chosen language, trip date and times kept |
| g_not_document.jpg | a picture that is not a paper | friendly "not a paper" error |
| h1_bill.png | electricity bill | total £72.02 first, due date |
| h2_dd_form.png | direct-debit form | one step per box |
| i_unreadable.jpg | tiny blurred crop | friendly "unreadable, take a clearer photo" error |
