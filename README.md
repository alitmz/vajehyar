# VajehYar v2.7.1 — Quiz Quality Fix

This maintenance release keeps every feature from v2.7 and fixes incomplete or ambiguous vocabulary questions.

## Fixed in v2.7.1

- Sentence-completion questions are created only when a complete example sentence contains the exact target word or expression.
- The invalid fallback text `Complete with the target word: _____` has been removed completely.
- Collocations and phrasal verbs whose examples use a different tense, article, plural form, or modified phrase now fall back to a definition/meaning question instead of showing an empty prompt.
- Every weekly-test question is validated before it can appear.
- Invalid questions are skipped and automatically replaced to keep the test at 12 questions whenever enough bank entries exist.
- Multiple-choice questions must contain four distinct options and the correct answer.
- Collocation distractors are better matched by grammatical role.
- AI-generated practice sets are validated too; incomplete gap-fill questions are removed automatically.
- Existing words, Leitner progress, XP, AI settings, and test history remain compatible.

## Deploy

Upload all files and the `icons` folder to the root of the existing GitHub Pages repository, replacing the previous files. Then open:

`https://alitmz.github.io/vajehyar/?release=2.7.1`

Refresh once. Do not clear site data.

## Security

Never place Groq or OpenRouter API keys in this repository. Each user should enter their own key in the app settings.
