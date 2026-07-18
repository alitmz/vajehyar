# VajehYar v2.3

VajehYar is a private, installable vocabulary-learning PWA designed for personal English study.

## New in v2.3

- **Android Share Target:** select or share a word from supported Android apps and choose VajehYar.
- **Context-aware saving:** save each word with the sentence where you found it, a source title/type, and an optional source link.
- **Four review modes:** meaning recall, reverse recall, fill-in-the-blank, and listening recall.
- **Four recall ratings:** Again, Hard, Good, and Easy with adaptive Leitner scheduling.
- **Active Practice:** write a paragraph using today's saved or reviewed words and earn a daily XP reward.

## Existing features

- English definitions, examples, pronunciation, Persian meaning, synonyms, antonyms, related words, and word-family clues
- Five-box Leitner system
- XP, levels, daily goals, streaks, and achievements
- Local-first storage and offline review
- Backup and restore
- Installable from Chrome as a standalone app

## Deploy on GitHub Pages

1. Extract the ZIP.
2. Upload all files and the `icons` folder to the root of your existing `vajehyar` repository.
3. Replace the previous files and commit the changes.
4. Wait for the GitHub Pages deployment to turn green.
5. Open:

   `https://alitmz.github.io/vajehyar/?release=2.3.0`

6. Refresh once. Do not clear site storage, because your saved vocabulary lives in the browser's local storage.

## Quick Share on Android

After the updated PWA is installed:

1. Select a word or text in a supported Android app.
2. Tap **Share**.
3. Choose **VajehYar**.
4. VajehYar opens the Dictionary tab, searches the shared word, and carries over the shared sentence and source when available.

The exact Share-menu behavior depends on the Android app sending the content.
