(async function bootVajehYar(){
  const RELEASE = '2.7.0';
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
  } catch (error) { console.warn('Release cache cleanup was skipped:', error); }
  function load(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.defer=true;script.onload=resolve;script.onerror=reject;document.body.appendChild(script);});}
  try {
    await load(`./ielts-bank-v2.7.js?release=${RELEASE}`);
    await load(`./app-v2.7.js?release=${RELEASE}`);
  } catch (error) {
    const message=document.createElement('div');message.style.cssText='position:fixed;inset:20px;z-index:9999;padding:20px;border-radius:16px;background:#fff1f2;color:#9f1239;font-family:Arial,sans-serif';message.textContent='VajehYar could not load the latest version. Refresh the page once.';document.body.appendChild(message);
  }
})();
