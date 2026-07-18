# VajehYar v2.2 — Personal Dictionary & Leitner Trainer

VajehYar is an installable Progressive Web App for building a personal English vocabulary library and reviewing words with a five-box Leitner system.

## Version 2.1

This release fixes the mobile bottom-navigation issue from version 2.0 and expands the dictionary with richer lexical relationships.

## Features

- English dictionary lookup with multiple meanings and definitions
- Pronunciation text and audio when available
- Usage examples and parts of speech
- Synonyms and antonyms from multiple public lexical sources
- Related words and estimated root/word-family forms
- Origin or etymology when supplied by the dictionary source
- Editable Persian meaning with Vazirmatn typography
- Five-box Leitner review schedule: 1, 2, 4, 8, and 16 days
- Local-first storage: no account, backend, or always-on computer required
- Offline review of saved vocabulary
- XP, levels, daily goals, streaks, and achievement badges
- Search history, library filters, backup, and restore
- Installable on Android from Chrome

## Publish with GitHub Pages

1. Upload every file in this folder to the root of your GitHub repository.
2. Replace the existing files when GitHub asks.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/ (root)**
5. Save the configuration.
6. Open `https://YOUR-USERNAME.github.io/vajehyar/` after deployment finishes.

## Updating an installed copy

After uploading version 2.1:

1. Open the website in Chrome.
2. Refresh the page once.
3. Close and reopen the installed app.

Do not clear site storage unless you already exported a backup, because saved words are stored locally on the device.

## Data and connectivity

- New dictionary searches require internet access.
- Saved words, Leitner reviews, XP, streaks, settings, and backups are stored locally.
- The original local-storage keys are preserved, so upgrading does not intentionally erase existing vocabulary.

## Dictionary services

The app uses public dictionary and lexical APIs. Root and word-family suggestions are estimates based on word structure and public lexical data; they should not be treated as guaranteed historical etymology. Users can edit the Persian meaning before saving.


## v2.2 reliability fix
- Fixed the startup `nowDateKey` initialization error that blocked all navigation tabs.
- Uses a release bootstrap and uniquely named JavaScript/CSS files to bypass stale service-worker caches.
- Uses network-first updates for application code while preserving offline review support.
