import os, hashlib, json, sys
root = sys.argv[1]
skip_dirs = {'store', 'reference', '.git', 'tools', 'node_modules', 'frames'}
files = []
h = hashlib.sha1()
for d, dirs, fs in os.walk(root):
    dirs[:] = sorted(x for x in dirs if x not in skip_dirs)
    for f in sorted(fs):
        if f in ('sw.js', 'README.md', 'BUILD.md') or f.endswith('.md') or f.endswith('.zip'):
            continue
        p = os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/')
        files.append('./' + p)
        h.update(open(os.path.join(d, f), 'rb').read())
version = h.hexdigest()[:10]
sw = f"""// First Flight service worker: offline-first app shell (generated).
const CACHE = 'first-flight-{version}';
const CORE = {json.dumps(['./'] + files)};
self.addEventListener('install', e => {{
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', e => {{
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('first-flight-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('fetch', e => {{
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // external links and fonts go to the network
  e.respondWith(caches.match(req, {{ ignoreSearch: true }}).then(hit => hit || fetch(req).then(res => {{
    if (res.ok) {{ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }}
    return res;
  }}).catch(() => req.mode === 'navigate' ? caches.match('./lab.html') : Response.error())));
}});
"""
open(os.path.join(root, 'sw.js'), 'w').write(sw)
print(version, len(files))
