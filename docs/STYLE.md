# EasyRead writing style guide

Based on UK Easy Read practice (Mencap; Dept of Health "Making written information easier to understand"). Readers: low literacy, learning disabilities, older people, non-native speakers. Every line is read aloud, so write for the ear as well as the eye.

## 1. Guide text (generated)
- One idea per sentence. 15 words or fewer. Aim for 8 to 10.
- Action first. Start with the verb: "Shake the inhaler." not "You should make sure to shake it."
- Say "you" and "your". No passive voice.
- Everyday words. "Use" not "administer". "Doctor" not "healthcare professional".
- Digits for numbers: "2 puffs", "3 times a week". Dates as "Friday 12 December". Money as "£120".
- A hard word that cannot be avoided: explain it once, right after: "Your inhaler has a *spacer*. A spacer is a plastic tube you breathe through."
- Keep the source's meaning. Never add, remove or soften a dose, date, amount or warning. If the paper is unclear or a field is blank, say so plainly: "The paper does not show the date." Do not add who to ask: the app never adds advice or people the paper does not name.
- One step = one action = one picture.

| Bad | Good |
|---|---|
| It is advisable to ensure the device is agitated prior to use. | Shake the inhaler. |
| Take 2 puffs, ideally, up to 4 times daily if required. | Take 2 puffs. You can do this up to 4 times a day. |
| Payment must be remitted within 14 days of the date of issue. | Pay by Friday 12 December. |
| Contact your GP should symptoms persist. | Still not better? Tell your doctor. |

## 1b. Step pictures (generated, `media/fal.py` CLOSEUP, NO_TEXT and STYLE)
- Close-ups only: hands + the one object the step is about (the letter, a phone, a pen, the device). No person, no face, no body, no room, no decoration. The live guide avatar is the only person on screen.
- Hands keep the guide's warm brown skin and a sage green sleeve cuff, so pictures match the animated close-ups in `web/src/closeups/`.
- Palette as the close-ups: sand #FCEBD6, cream glow #FFF6EA, ink #3A2A20, orange #F5973F, sage #DCEBDF, skin #B5744A, sleeve #93A27A. Flat vector, thick dark brown outlines.
- No text, letters or numbers anywhere: paper and screens show plain grey lines only. `wordless()` strips senders, dates, names, quotes and digits from the step prompt before it is sent (they made the model write on the paper), and turns a named person into hands.
- Model: `fal-ai/flux/schnell`, plain text-to-image, 512x512 (about $0.0008 a picture, 1-3 s). No reference image.
- A step only gets a picture when it has no animated close-up (`step.visual`) and no highlight on the user's photo (`step.highlights`); at most `PICTURE_CAP` (default 4) per guide, the steps naming the most concrete objects first. The rest show the close-up, the photo or the text.

## 2. UI copy
- Buttons are verbs, 1 to 3 words: "Take a photo", "Use this", "Make my guide".
- Say what happens next. Say where the user is: "Page 2 of 3".
- Errors: say what went wrong, then what to do. Never blame the user.
- No jargon: "photo" not "image capture", "paper" not "document".
- No exclamation marks. No emoji. Labels in sentence case.

| Bad | Good |
|---|---|
| Oops! Something went wrong! | We could not read this photo. Try again. |
| Upload documents for processing | Add a paper |
| Error 422: invalid input | This is not a photo of a paper. Try another. |
| Submit | Make my guide |

## 3. The avatar and the voice
- Short turns: 1 or 2 sentences, then stop. Let the person act or ask.
- Plain, calm, steady. Like a good pharmacist or a patient neighbour. Not a cheerleader.
- Say what the step is, why it matters in 1 short line at most, then wait.
- Praise only by naming what was done: "That is right. You use the blue one when you feel tight." Not "Amazing job!".
- If the paper does not say: "That is not on your paper. Ask <the sender>." (the sender printed on the paper). Never guess, never add advice.
- Captions show exactly what the voice says.

| Bad | Good |
|---|---|
| Great question! Let's dive in. Absolutely! | You take 2 puffs. |
| Don't worry, you're doing amazing! | That is right. Now breathe in slowly. |
| I'm here to help with anything you need! | Ask me about this paper. |

## 4. Sounds like AI: never write
- "Great question!", "Let's dive in", "Absolutely!", "Certainly!", "Sure thing!"
- "I'm here to help", "Feel free to", "Don't worry", "No problem at all"
- "It's important to note", "Remember that", "Keep in mind"
- Em-dash chains and long dashed asides. Use a full stop.
- Triple lists of adjectives ("clear, simple and friendly").
- Emoji. Exclamation marks.
- Overuse of "simply", "just", "easily", "quickly". They make hard things sound easy and shame people who struggle.
- Generic reassurance ("You've got this", "It's totally normal") unless the paper itself says it.

## 5. Output shapes by document type
**How-to (medicine device, appliance, form of use):** Title "How to use your inhaler". Numbered steps, one action and one picture each. A "Take care" step (butter colour) for warnings the paper gives. For a medicine device, the technique steps come from the fixed outline in `agent/technique.py`, and the dose is said exactly as printed.

**Letter or bill:**
- This is: 1 line ("A letter from your council about unpaid council tax.")
- What you need to do: 1 to 3 short actions.
- By when: date, in bold.
- Key amounts and dates listed with labels ("You owe: £212. Pay by: Friday 12 December.")

**Form:** Go box by box. "Box 3, Your name: write your full name as it is on your passport." Name what goes in each box and an example. Say which boxes can stay empty.

**Title:** a short plain title of 6 words or fewer, e.g. "Amoxicillin liquid", "Council tax bill".

## 6. No added safety or advice lines
- The app adds no advice, help lines or people of its own: no 999, no 111, no "ask your pharmacist", no Citizens Advice. `agent/paperguard.py` removes such sentences (in 6 languages) unless the paper itself says them.
- Help lines printed on the paper (for example "If you feel very unwell, call 111") are kept as steps, word for word.
- When a question is not answered by the paper, the answer says so and names the sender printed on the paper.
