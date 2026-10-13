/* ALUR (Lab Maya Pseudocode) — service worker: simpan aset agar lab tetap jalan tanpa internet */
const CACHE = 'alur-v2';
const FONTS = ['jetbrains-mono-400', 'jetbrains-mono-700', 'ibm-plex-sans-400', 'ibm-plex-sans-400-italic', 'ibm-plex-sans-500', 'ibm-plex-sans-600', 'newsreader-500', 'newsreader-600'].map(f => './fonts/' + f + '.woff2');
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', ...FONTS];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const put = (req, res) => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; };
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith(fetch(req).then(res => put(req, res)).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
      return;
    }
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => put(req, res))));
    return;
  }
});
