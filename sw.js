/* Offline cache. Network first so updates show up immediately; cache when offline.
   Bump CACHE when the asset list changes. */
const CACHE = 'ielts-zh-vocab-v2-mwtbnu9p'
const ASSETS = [
  './',
  'index.html',
  'css/app.css',
  'js/icons.js',
  'data/vocabulary.js',
  'js/judge.js',
  'js/core.js',
  'js/util.js',
  'js/store.js',
  'js/speech.js',
  'js/scheduler.js',
  'js/session.js',
  'js/db.js',
  'js/practice.js',
  'js/views.js',
  'js/train.js',
  'js/train-home.js',
  'js/main.js',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin)
    return
  event.respondWith(
    // Revalidate with the server so a new deployment shows up on the next open.
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then(cache => cache.put(req, copy))
        }
        // Server or tunnel down (5xx): the cached copy still opens the app with its saved progress.
        else if (res.status >= 500) {
          return caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : null)).then(hit => hit || res)
        }
        return res
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))),
  )
})
