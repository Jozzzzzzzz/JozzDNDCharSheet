/* Service worker — cache-first for same-origin static assets, network-only for
 * everything else (Firebase, Open5e, 5esrd, any cross-origin call).
 *
 * Versioning: index.html registers this as `sw.js?v=<scriptVersion>`. We read that
 * query param and fold it into the cache name, so bumping `scriptVersion` in index.html
 * creates a fresh cache and the old one is deleted on activate. That means the existing
 * cache-busting (`?v=` on script URLs) and the SW cache stay in lockstep — no stale JS.
 */

const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const CACHE_NAME = `jozzdnd-${VERSION}`;

// The app shell — everything needed to boot offline. Kept in sync with index.html's
// loadText() list + scriptOrder. If you add a page/partial/module there, add it here.
const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/icon.svg',
  'assets/styles.css',
  'assets/data/spells.json',
  'assets/data/items.json',
  // Partials
  'partials/chrome.html',
  'partials/popups.html',
  'partials/dm-chrome.html',
  // Player pages
  'pages/home.html',
  'pages/settings.html',
  'pages/stats.html',
  'pages/background.html',
  'pages/spells.html',
  'pages/inventory.html',
  'pages/notes.html',
  // DM pages
  'pages/dm-home.html',
  'pages/dm-lore.html',
  'pages/dm-players.html',
  'pages/dm-spells.html',
  'pages/dm-monsters.html',
  'pages/dm-items.html',
  'pages/dm-encounters.html',
  'pages/dm-npcs.html',
  'pages/dm-notes.html',
  'pages/dm-settings.html',
  // JS modules (loaded with ?v=, but we cache the bare path; see fetch handler)
  'assets/banner-messages.js',
  'assets/modules/stats.js',
  'assets/modules/cloud-skills.js',
  'assets/modules/core.js',
  'assets/modules/browser-engine.js',
  'assets/modules/layout.js',
  'assets/modules/characters.js',
  'assets/modules/health.js',
  'assets/modules/dice.js',
  'assets/modules/actions.js',
  'assets/modules/inventory.js',
  'assets/modules/spells.js',
  'assets/modules/admin.js',
  'assets/modules/dm.js',
  'assets/changelog.js',
  'assets/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Don't fail install if one optional asset 404s — cache what we can.
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('jozzdnd-') && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Cross-origin hosts that must ALWAYS go to network (never cached). Firebase/Firestore
// need live data; Open5e/5esrd are reference lookups the app already handles offline via
// the bundled spells.json.
function isNetworkOnly(url) {
  return url.origin !== self.location.origin
    || url.pathname.includes('/__/')       // Firebase reserved paths
    || url.hostname.includes('firebase')
    || url.hostname.includes('googleapis')
    || url.hostname.includes('gstatic');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET; let the browser do POST/PUT/etc. straight to network.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (isNetworkOnly(url)) return; // default browser handling (network)

  // Cache-first for same-origin static assets. We normalise the cache key to the path
  // WITHOUT the `?v=` query so a single cached copy serves regardless of the version
  // query on the request URL (the version already scopes the whole cache).
  const cacheKey = url.origin + url.pathname;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(cacheKey).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((resp) => {
          // Only cache good, same-origin, basic responses.
          if (resp && resp.status === 200 && resp.type === 'basic') {
            cache.put(cacheKey, resp.clone());
          }
          return resp;
        }).catch(() => cached); // offline + not cached → whatever we have (may be undefined)
      })
    )
  );
});
