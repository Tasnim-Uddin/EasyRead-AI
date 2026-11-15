# EasyRead writing style guide

Based on UK Easy Read practice (Mencap; Dept of Health "Making written information easier to understand"). Readers: low literacy, learning disabilities, older people, non-native speakers. Every line is read aloud, so write for the ear as well as the eye.

## 1. Guide text (generated)
- One idea per sentence. 15 words or fewer. Aim for 8 to 10.
- Action first. Start with the verb: "Shake the inhaler." not "You should make sure to shake it."
- Say "you" and "your". No passive voice.
- Everyday words. "Use" not "administer". "Doctor" not "healthcare professional".
- Digits for numbers: "2 puffs", "3 times a week". Dates as "Friday 12 December". Money as "£120".
- A hard word that cannot be avoided: explain it once, right after: "Your inhaler has a *spacer*. A spacer is a plastic tube you breathe through."
- Keep the source's meaning. Never add, remove or soften a dose, date, amount or warning. If the paper is unclear, say so: "The paper does not say. Ask your pharmacist."
- One step = one action = one picture.

| Bad | Good |
|---|---|
| It is advisable to ensure the device is agitated prior to use. | Shake the inhaler. |
| Take 2 puffs, ideally, up to 4 times daily if required. | Take 2 puffs. You can do this up to 4 times a day. |
| Payment must be remitted within 14 days of the date of issue. | Pay by Friday 12 December. |
| Contact your GP should symptoms persist. | Still not better? Tell your doctor. |

## 1b. Step pictures and the guide (generated, `media/fal.py` STYLE and CHARACTER)
- Simple flat friendly vector illustration, thick dark brown outlines, plain solid cream background.
- Palette only: cream #FFF6E9, ink #3A2A20, orange #FF9B3D, sage #C9E2D2, butter #FFE49A.
- One clear action per picture. Uncluttered: no busy room, no extra objects.
- One character: the person in every picture is the live guide, the same woman as the Anam avatar (warm brown skin, black hair in a top bun, round orange earrings, sage green top). The guide portrait goes with every picture request as a reference image (`media/guide_ref.jpg`, model `fal-ai/nano-banana/edit`). Other people (a pharmacist, a doctor) may appear, but the main person is always the guide. Steps with no person stay without one.
- No text, letters or numbers anywhere, including clock faces, phone screens and labels on objects. Captions come from the app.
- Name objects in the step's picture prompt, not in the shared CHARACTER line, or the model puts them in every picture.
- The live guide (Anam avatar) and the step pictures are one character in one style, so they look like one product:
  `design/guide-cartoon/chosen.png` (made with `fal-ai/flux/dev`, 1152x1152, cream background, sage top).

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
- If it does not know: "I do not know. Ask your pharmacist." Never guess about doses.
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
- Emoji. Exclamation marks (only in a real warning, e.g. "Call 999 now.").
- Overuse of "simply", "just", "easily", "quickly". They make hard things sound easy and shame people who struggle.
- Generic reassurance ("You've got this", "It's totally normal") unless the paper itself says it.

## 5. Output shapes by document type
**How-to (medicine device, appliance, form of use):** Title "How to use your inhaler". Numbered steps, one action and one picture each. A "Take care" step (butter colour) for risks. End with "Check you understood" questions.

**Letter or bill:**
- This is: 1 line ("A letter from your council about unpaid council tax.")
- What you need to do: 1 to 3 short actions.
- By when: date, in bold.
- Key amounts and dates listed with labels ("You owe: £212. Pay by: Friday 12 December.")

**Form:** Go box by box. "Box 3, Your name: write your full name as it is on your passport." Name what goes in each box and an example. Say which boxes can stay empty.

**Medicine summary:** "This is: your inhaler (salbutamol). You will learn 5 steps. From: your label and your leaflet."

## 6. Safety lines (always on the final screen of the type)
- Medicine: "Not sure? Ask your pharmacist. For advice, call 111. In an emergency, call 999."
- Money or legal: "Get free advice before you sign or pay. Citizens Advice can help: 0800 144 8848."
- Housing, benefits, immigration: same as money, plus "Do not ignore the letter."
- Every guide: "This guide is based on your paper. It does not replace advice from a professional."
