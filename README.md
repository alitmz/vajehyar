# VajehYar v2.7 — Smart Cloud AI Router

VajehYar is a mobile-first PWA for personal English vocabulary learning, IELTS Band 7 preparation, Leitner review, weekly mixed tests, active writing, and AI-assisted feedback.

## New in v2.7

- Groq and OpenRouter support
- Each user supplies their own provider key or connects OpenRouter with OAuth PKCE
- No API key is bundled in the public GitHub repository
- Session-only key storage by default; optional device storage on trusted devices
- API keys are excluded from backups
- Smart provider fallback and model rotation
- Dynamic model discovery from both providers
- OpenRouter free-model-only mode
- Task-aware model selection for sentence feedback, IELTS writing, and question generation
- Daily in-app soft cap and usage counters
- Exact-result cache to avoid repeating identical API calls
- Clear handling of invalid keys, quota limits, rate limits, timeouts, and unavailable models

## Security

Never commit API keys to GitHub. Every user should connect their own Groq or OpenRouter account. Browser-side keys can be inspected by someone with access to that device, so session-only storage is the safest default.

## Deployment

Upload every file and folder from this package to the root of your GitHub Pages repository and replace older files. Then visit:

`https://alitmz.github.io/vajehyar/?release=2.7.0`

Refresh once after GitHub Pages finishes deploying. Existing vocabulary and progress use the same storage keys and remain available.
