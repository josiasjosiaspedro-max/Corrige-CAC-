const CACHE='corrige-cac-static-3.2.7';
const APP=new URL('./',self.registration.scope).href;
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.add(APP)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('fetch',event=>{const req=event.request;const url=new URL(req.url);if(req.method!=='GET'||req.mode!=='navigate'||!url.href.startsWith(APP))return;event.respondWith((async()=>{try{const res=await fetch(req,{cache:'no-store'});if(res.ok&&!url.search){const cache=await caches.open(CACHE);await cache.put(APP,res.clone());}return res;}catch(error){const cache=await caches.open(CACHE);return (await cache.match(APP))||Response.error();}})());});
