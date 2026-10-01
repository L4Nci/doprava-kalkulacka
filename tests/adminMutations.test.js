import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminMutations, productPatch, positiveInteger } from '../src/services/adminMutations.js';
import { requireNetworkOnlyWorker } from '../src/lib/apiFetch.js';

// Offline transport double: deliberately models denied/zero-row writes and stale reads.
function clientWith(...results) {
  const calls = [];
  const client = { calls, from(table) { calls.push(['from', table]); return chain; },
    rpc(name, args) { calls.push(['rpc', name, args]); return Promise.resolve(results.shift()); } };
  const chain = {};
  for (const method of ['insert', 'update', 'delete', 'select', 'eq']) {
    chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
  }
  for (const method of ['single', 'maybeSingle']) chain[method] = () => Promise.resolve(results.shift());
  return client;
}
const ok = data => ({ data, error: null });

test('zero affected rows is not success, even when error is null', async () => {
  for (const operation of ['update', 'remove']) {
    const client = clientWith(ok([]));
    await assert.rejects(createAdminMutations(client)[operation]('services', 's1', { price_per_unit: 123 }), /nepotvrdila/);
  }
});
test('RLS rejection propagates instead of confirming an insert', async () => {
  const failure = { code: '42501', message: 'RLS denied' };
  await assert.rejects(createAdminMutations(clientWith({ data: null, error: failure })).insert('products', { name: 'test' }), error => error === failure);
});
test('price confirmation requires returned row AND fresh matching read', async () => {
  const saved = { id: 's1', price_per_unit: 456 };
  const client = clientWith(ok(saved), ok(saved));
  assert.deepEqual(await createAdminMutations(client).update('services', 's1', { price_per_unit: 456 }), saved);
  assert.equal(client.calls.filter(([name]) => name === 'from').length, 2);
  await assert.rejects(createAdminMutations(clientWith(ok(saved), ok({ id: 's1', price_per_unit: 123 }))).update('services', 's1', { price_per_unit: 456 }), /nepotvrdila/);
});
test('verification failure after a write remains unconfirmed', async () => {
  await assert.rejects(createAdminMutations(clientWith(ok({ id: 's1', price_per_unit: 456 }), { error: new Error('offline') })).update('services', 's1', { price_per_unit: 456 }), /offline/);
});
test('insert verifies persisted fields', async () => {
  const saved = { id: 'p1', name: 'test' };
  assert.deepEqual(await createAdminMutations(clientWith(ok(saved), ok(saved))).insert('products', { name: 'test' }), saved);
});
test('delete requires returned ID and confirmed absence', async () => {
  assert.deepEqual(await createAdminMutations(clientWith(ok({ id: 'c1' }), ok(null))).remove('carriers', 'c1'), { id: 'c1' });
  await assert.rejects(createAdminMutations(clientWith(ok({ id: 'c1' }), ok({ id: 'c1' }))).remove('carriers', 'c1'), /nepotvrdila/);
});
test('carrier creation verifies all services, including repeated identical services', async () => {
  const service = { name: 'test', shipment_type: 'balik', price_per_unit: 100 };
  const draft = { name: 'GLS HU', logo_url: '', supported_countries: ['HU'], services: [service, service] };
  const saved = { ...draft, id: 'c1' };
  assert.deepEqual(await createAdminMutations(clientWith(ok([saved]), ok(saved))).createCarrier(draft), saved);
  await assert.rejects(createAdminMutations(clientWith(ok([saved]), ok({ ...saved, services: [service] }))).createCarrier(draft), /nepotvrdila/);
});
test('disabling and re-enabling shipping never erases capacities', () => {
  let row = { items_per_box: 11, items_per_pallet: 22, parcel_disabled: false, pallet_disabled: false };
  for (const updates of [{ parcel_disabled: true }, { parcel_disabled: false }, { pallet_disabled: true }, { pallet_disabled: false }]) {
    row = { ...row, ...productPatch(row, updates) };
    assert.equal(row.items_per_box, 11);
    assert.equal(row.items_per_pallet, 22);
  }
  assert.throws(() => productPatch(row, { items_per_box: null }));
});
test('price and capacity validation does not truncate input or treat empty as zero', () => {
  for (const value of ['', null, -1, '1.5', Infinity]) assert.throws(() => positiveInteger(value, 'Cena', 0));
  assert.equal(positiveInteger('0', 'Cena', 0), 0);
});
test('old service worker cannot serve API reads until upgraded', async () => {
  await assert.rejects(requireNetworkOnlyWorker({ postMessage() {} }, () => new MessageChannel(), 20), /Aktualizace/);
  await requireNetworkOnlyWorker({ postMessage(_message, [port]) { port.postMessage('API_NETWORK_ONLY_V1'); } });
  await requireNetworkOnlyWorker(null);
});
