// 商店街物語 LinguaMachi - Service Worker
// 讓 App 可以安裝到手機，並在沒有網路時也能開啟（盤點、五十音、叫賣不需要 API）
const VERSION = 'shotengai-v1';
const SHELL = ['./', './index.html', './tailwind.css', './manifest.webmanifest'];
// 圖示與美術：有就預先快取，缺檔不影響安裝
const OPTIONAL = [
    './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-64.png',
    ...['yatai', 'konbini', 'ramen', 'cafe', 'sushi', 'drug', 'ekiben', 'ryokan'].flatMap(t => [1, 2, 3].map(n => `./art/shop_${t}_${n}.webp`)),
    ...['aisatsu', 'kazu', 'konbini', 'gurume', 'eki', 'kaimono', 'yado', 'kusuri', 'kurashi', 'kisetsu', 'tomodachi', 'izakaya', 'kuukou', 'asobi', 'bijinesu', 'kinkyuu'].map(id => `./art/critic_${id}.webp`)
];
const RUNTIME = `${VERSION}-runtime`;
const NEVER_CACHE = ['api.anthropic.com'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(VERSION)
            .then(c => c.addAll(SHELL).then(() => Promise.allSettled(OPTIONAL.map(u => c.add(u)))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (NEVER_CACHE.includes(url.hostname)) return;

    // 自己的頁面：先抓網路（拿到最新版），失敗再用快取
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(req)
                .then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })
                .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
        );
        return;
    }

    // CDN（字型、Fluent 圖示、彩帶特效）：先用快取，背景再更新
    event.respondWith(
        caches.open(RUNTIME).then(cache => cache.match(req).then(hit => {
            const net = fetch(req).then(res => {
                if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
                return res;
            }).catch(() => hit);
            return hit || net;
        }))
    );
});
