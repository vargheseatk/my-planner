// Service worker: makes the planner installable and opens it instantly, even on slow or no data.
// The page shell opens from the phone's copy and refreshes in the background (a deploy shows up on the
// next open). Hashed assets and Google Fonts are cache-first. Supabase calls are never cached:
// the app keeps its own saved copy of the data.
const CACHE = 'planner-v3'
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

const store = (key, res) => {
  if (res.ok || res.type === 'opaque') {
    const copy = res.clone()
    caches.open(CACHE).then((c) => c.put(key, copy))
  }
  return res
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const sameOrigin = url.origin === location.origin
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return

  if (req.mode === 'navigate') {
    const fresh = fetch(req).then((res) => store('./', res))
    e.respondWith(caches.match('./').then((hit) => hit || fresh))
    e.waitUntil(fresh.catch(() => {}))
    return
  }

  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => store(req, res))))
})
