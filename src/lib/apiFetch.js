// An already installed legacy worker can still control the new page until activation.
// Fail closed instead of allowing that worker to answer a verification read from cache.
const checkedWorkers = new WeakMap();

export async function requireNetworkOnlyWorker(worker, channelFactory = () => new MessageChannel(), timeoutMs = 2000) {
  if (!worker) return;
  if (!checkedWorkers.has(worker)) {
    const check = new Promise((resolve, reject) => {
      const channel = channelFactory();
      const finish = (error) => {
        clearTimeout(timer);
        channel.port1.close();
        channel.port2.close();
        if (error) reject(error); else resolve();
      };
      const timer = setTimeout(() => finish(new Error('Aktualizace aplikace ještě není dokončena. Obnovte stránku před načítáním nebo změnou dat.')), timeoutMs);
      channel.port1.onmessage = (event) => {
        if (event.data === 'API_NETWORK_ONLY_V1') finish();
      };
      try { worker.postMessage('CHECK_API_NETWORK_ONLY', [channel.port2]); }
      catch (error) { finish(error); }
    });
    checkedWorkers.set(worker, check);
    check.catch(() => checkedWorkers.delete(worker));
  }
  await checkedWorkers.get(worker);
}

export async function fetchWithoutApiCache(input, init) {
  await requireNetworkOnlyWorker(globalThis.navigator?.serviceWorker?.controller);
  return fetch(input, { ...init, cache: 'no-store' });
}
