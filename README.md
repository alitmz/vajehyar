# VajehYar

VajehYar is an installable Progressive Web App for building a personal English vocabulary library and reviewing words with a five-box Leitner system.

## Features

- English dictionary lookup with multiple meanings and definitions
- Pronunciation text and audio when available
- Usage examples, parts of speech, synonyms, antonyms, and source links
- Editable Persian meaning with Vazirmatn typography
- Five-box Leitner review schedule: 1, 2, 4, 8, and 16 days
- Local-first storage: no account, backend, or always-on computer required
- Offline review of saved vocabulary
- XP, levels, daily goals, streaks, and achievement badges
- Search history, library filters, backup, and restore
- Installable on Android from Chrome

## Publish with GitHub Pages

1. Upload every file in this folder to the root of your GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**
4. Save the configuration.
5. After deployment, open:

   `https://YOUR-USERNAME.github.io/vajehyar/`

## Install on Android

1. Open the deployed URL in Chrome.
2. Open the Chrome menu.
3. Choose **Install app** or **Add to Home screen**.

## Data and connectivity

- New dictionary searches require internet access.
- Saved words, Leitner reviews, XP, streaks, settings, and backups are stored locally on the device.
- Updating the app files does not intentionally erase the existing vocabulary database because the original local-storage key is preserved.

## Dictionary services

The app uses the public Dictionary API for English lexical data and MyMemory for a suggested Persian translation. Availability and response quality depend on those public services. Users can always edit the Persian meaning before saving.
