# VajehYar v2.6 — Offline AI Tutor

VajehYar is a private, installable vocabulary and IELTS-learning PWA. Version 2.6 adds an optional language model that runs inside the browser on the user's own device.

## New in v2.6

- **Offline AI Tutor:** sentence and paragraph feedback runs locally after a one-time model download.
- **No API key or token billing:** the tutor uses an open-weight model through WebLLM rather than a paid cloud API.
- **Two model choices:** a Lite Qwen 2.5 0.5B model and a higher-quality Qwen 3 1.7B model.
- **Sentence Coach:** grammar, spelling, word choice, target-word usage, collocations, naturalness, corrected text, and a rewrite task.
- **Active Practice integration:** send today's paragraph directly to the AI Tutor and preserve the structured feedback with the practice session.
- **IELTS Writing Coach:** educational band-range feedback organised around Task Response/Achievement, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy.
- **Question Builder:** generates extra practice while grounding correct answers in the user's saved words or the bundled IELTS vocabulary bank.
- **Private history:** recent feedback is kept in local storage and included in VajehYar backups.
- **Model controls:** download/load, stop generation, choose feedback language, and remove the downloaded model.

## Important limitations

- The first AI setup is a large download and needs internet access.
- The browser and phone must support WebGPU. Current Chrome versions are recommended.
- The Standard model needs substantially more memory than the Lite model and may not work on every phone.
- Browser storage can be cleared by the operating system or user. Keep VajehYar backups.
- Small local models can miss errors or give imperfect advice. IELTS band feedback is educational and is not an official examiner score.
- “Free forever” here means no per-request API fee and no hosted inference account. It does not guarantee that third-party model hosting URLs will never change; the runtime and model are open-weight/open-source components.

## Deploy on GitHub Pages

1. Extract the ZIP.
2. Upload every file and the `icons` and `vendor` folders to the root of the existing `vajehyar` repository.
3. Replace the old files and commit.
4. Wait for GitHub Pages deployment to become green.
5. Open `https://alitmz.github.io/vajehyar/?release=2.6.0` and refresh once.
6. Do not clear site storage; your library, progress, feedback history, and downloaded model live in browser storage.

## Third-party components

- WebLLM 0.2.84, Apache License 2.0. Its license is included in `vendor/WEBLLM-LICENSE.txt`.
- Qwen model weights are downloaded on demand from the MLC AI model repositories. The selected Qwen models are open-weight and distributed under their model licences.
