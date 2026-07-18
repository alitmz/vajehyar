(async function bootVajehYar(){
  const RELEASE = '2.2.0';
  const MARKER = `vajehyar_release_${RELEASE}`;
  try {
    if (localStorage.getItem(MARKER) !== 'ready') {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('vajehyar-')).map(key => caches.delete(key)));
      }
      localStorage.setItem(MARKER, 'ready');
    }
  } catch (error) {
    console.warn('Release cache cleanup was skipped:', error);
  }

  const script = document.createElement('script');
  script.src = `./app-v2.2.js?release=${RELEASE}`;
  script.defer = true;
  script.onerror = () => {
    const message = document.createElement('div');
    message.style.cssText = 'position:fixed;inset:20px;z-index:9999;padding:20px;border-radius:16px;background:#fff1f2;color:#9f1239;font-family:Arial,sans-serif';
    message.textContent = 'VajehYar could not load the latest application file. Refresh the page once.';
    document.body.appendChild(message);
  };
  document.body.appendChild(script);
})();
