// Retire the old API cache when the new worker activates.
self.addEventListener('activate', event => {
  event.waitUntil(caches.delete('supabase-cache'));
});

self.addEventListener('message', event => {
  if (event.data === 'CHECK_API_NETWORK_ONLY') event.ports[0]?.postMessage('API_NETWORK_ONLY_V1');
});
