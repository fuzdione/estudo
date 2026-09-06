/* sw.js — service worker.
   Só cacheia o "casco" do app (HTML, CSS, JS). As chamadas ao Apps Script
   nunca entram no cache: elas passam pela fila do IndexedDB quando falham. */

const CACHE = 'estudo-v1';
const CASCO = ['./', 'index.html', 'styles.css', 'app.js', 'db.js', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CASCO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // POST vai direto à rede
  if (req.url.includes('script.google.com')) return;      // dados sempre frescos

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && new URL(req.url).origin === location.origin) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
      }
      return res;
    }).catch(() => caches.match('index.html')))
  );
});
