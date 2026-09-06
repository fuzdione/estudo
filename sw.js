/* sw.js — service worker.

   Estratégia: rede primeiro, cache como rede de segurança.

   A versão anterior era cache primeiro, e isso deixou o app preso numa versão
   antiga: o navegador só reinstala o worker quando o próprio sw.js muda, então
   publicar app.js novo não adiantava nada. Rede primeiro custa uma ida ao
   servidor por arquivo — o app tem seis, todos pequenos — e em troca uma
   publicação chega ao aparelho no primeiro carregamento com rede.

   Offline continua funcionando: sem rede, a resposta vem do cache. */

const CACHE = 'estudo-v2';
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
  if (new URL(req.url).origin !== location.origin) return; // Apps Script: sempre fresco

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req)
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
