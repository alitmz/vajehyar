# Updating VajehYar to v2.4

1. Extract `vajehyar-pwa-v2.4-ready.zip`.
2. Upload all extracted files and the `icons` folder to the root of `alitmz/vajehyar`.
3. Replace previous files and commit the update.
4. Wait for GitHub Pages deployment to finish.
5. Open `https://alitmz.github.io/vajehyar/?release=2.4.0` and refresh once.

The new release uses new versioned JavaScript, CSS, bootstrap, and service-worker filenames to avoid the older cached app code. Existing words, Leitner progress, XP, streaks, search history, source sentences, and active-practice writing remain in the same local storage.

Weekly-test history is included in future backup files. Older backups still restore correctly; they simply have no weekly history yet.
