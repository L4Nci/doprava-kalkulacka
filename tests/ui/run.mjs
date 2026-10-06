import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { carrierUxAcceptance } from './carrierUx.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, args: ['--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const base = process.env.UI_BASE || 'http://127.0.0.1:5173';
const html = component => `<!doctype html><html><head><title>Offline CRUD acceptance</title>
<script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script>
<script type="module" src="/@vite/client"></script></head><body><div id="root"></div>
<script type="module">import React from '/node_modules/.vite/deps/react.js';import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';import * as Module from '/src/components/${component}.jsx';import '/src/index.css';const Component=Module.default||Module.PriceNotification;ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));</script></body></html>`;
await page.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin === 'http://localhost:3001' && url.pathname === '/audit-log') return route.fulfill({ json: { success: true }, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  if (url.origin !== base) return route.abort(); // External/prod traffic is impossible in this test.
  if (url.pathname === '/src/lib/supabaseClient.js') return route.fulfill({ contentType: 'application/javascript', body: readFileSync(new URL('./supabaseMock.js', import.meta.url), 'utf8') });
  if (url.pathname === '/__crud-test.html') return route.fulfill({ contentType: 'text/html', body: html(url.searchParams.get('component') || 'Courier') });
  return route.continue();
});
async function visible(locator) { await locator.waitFor({ state: 'visible' }); }
async function count(locator, expected) { await page.waitForFunction(({ selector, expected }) => document.querySelectorAll(selector).length === expected, { selector: 'vite-error-overlay', expected: 0 }); assert.equal(await locator.count(), expected); }
async function persisted() { return page.evaluate(() => JSON.parse(localStorage.getItem('crud-test-db'))); }
async function editPrice(value) {
  await page.getByTitle('Upravit cenu').click();
  await page.getByLabel('Cena služby', { exact: true }).fill(value);
}
async function carrierCard(name) {
  return page.getByRole('article', { name, exact: true });
}
try {
  await page.goto(`${base}/__crud-test.html`);
  await visible(page.getByRole('heading', { name: 'Dopravci', exact: true }));
  assert.equal(await page.title(), 'Offline CRUD acceptance');
  await page.getByRole('button', { name: 'Přidat dopravce', exact: true }).click();
  const modal = page.locator('div.fixed').filter({ has: page.getByRole('heading', { name: 'Nový dopravce' }) });
  await modal.locator('input[type=text]').nth(0).fill('GLS HU');
  await modal.getByText('HU', { exact: true }).click();
  await modal.getByPlaceholder('Název služby').fill('GLS HU parcel');
  await modal.getByPlaceholder('Cena', { exact: true }).fill('100');
  await modal.getByRole('button', { name: 'Vytvořit dopravce' }).evaluate(button => { button.click(); button.click(); });
  await visible(page.getByRole('heading', { name: 'GLS HU', exact: true }));
  await visible(page.getByText('GLS HU parcel', { exact: true }));
  assert.equal((await persisted()).carriers.length, 1);
  assert.equal(await page.evaluate(() => window.crudCalls.filter(c => c.action === 'rpc').length), 1, 'double submission blocked');
  assert.ok(await page.evaluate(() => window.crudCalls.filter(c => c.table === 'carriers' && c.action === 'select').length >= 3), 'create must finish with a fresh full carrier read');
  await page.reload();
  await visible(page.getByRole('heading', { name: 'GLS HU', exact: true }));
  await visible(page.getByText('GLS HU parcel', { exact: true }));
  await page.goto('about:blank');
  await page.goto(`${base}/__crud-test.html`);
  await visible(page.getByRole('heading', { name: 'GLS HU', exact: true }));
  await visible(page.getByText('GLS HU parcel', { exact: true }));
  let glsCard = await carrierCard('GLS HU');
  await glsCard.getByTitle('Upravit dopravce').click();
  await page.getByLabel('URL loga').fill('/icons/icon-192.png');
  await page.getByRole('button', { name: 'Uložit dopravce' }).click();
  glsCard = await carrierCard('GLS HU');
  await visible(glsCard.getByRole('img', { name: 'GLS HU' }));
  assert.equal((await persisted()).carriers[0].logo_url, '/icons/icon-192.png');
  await page.reload();
  glsCard = await carrierCard('GLS HU');
  assert.equal(await glsCard.getByRole('img', { name: 'GLS HU' }).getAttribute('src'), '/icons/icon-192.png');
  await glsCard.getByTitle('Upravit dopravce').click();
  await page.getByLabel('URL loga').fill('/icons/icon-512.png');
  await page.getByRole('button', { name: 'Uložit dopravce' }).click();
  await page.getByLabel('URL loga').waitFor({ state: 'detached' });
  glsCard = await carrierCard('GLS HU');
  assert.equal(await glsCard.getByRole('img', { name: 'GLS HU' }).getAttribute('src'), '/icons/icon-512.png');
  await glsCard.getByTitle('Upravit dopravce').click();
  await page.getByLabel('URL loga').fill('data:text/plain,not-an-image');
  await page.getByRole('button', { name: 'Uložit dopravce' }).click();
  glsCard = await carrierCard('GLS HU');
  await glsCard.getByRole('img', { name: 'GLS HU' }).waitFor({ state: 'detached' });
  await glsCard.getByTitle('Upravit dopravce').click();
  await page.getByLabel('URL loga').fill('');
  await page.getByRole('button', { name: 'Uložit dopravce' }).click();
  await page.getByLabel('URL loga').waitFor({ state: 'detached' });
  assert.equal((await persisted()).carriers[0].logo_url, null);
  await page.reload();
  glsCard = await carrierCard('GLS HU');
  assert.equal(await glsCard.getByRole('img', { name: 'GLS HU' }).count(), 0);
  console.log('PASS: optional carrier logo add/change/remove persists and broken image falls back');
  await editPrice('234');
  assert.equal((await persisted()).services[0].price_per_unit, 100, 'typing must not save');
  await page.getByRole('button', { name: 'Uložit cenu' }).click();
  await visible(page.getByText('234 Kč', { exact: true }));
  await page.reload();
  await visible(page.getByText('234 Kč', { exact: true }));
  console.log('PASS: admin create + price draft + save + reload');
  glsCard = await carrierCard('GLS HU');
  await glsCard.locator('summary').click();
  await glsCard.getByRole('button', { name: 'Deaktivovat dopravce', exact: true }).click();
  await page.getByRole('button', { name: /^Neaktivní \(/ }).click();
  await visible(page.getByRole('heading', { name: 'GLS HU', exact: true }));
  assert.equal((await persisted()).carriers[0].active, false);
  await page.reload();
  await page.getByRole('button', { name: /^Neaktivní \(/ }).click();
  glsCard = await carrierCard('GLS HU');
  await glsCard.locator('summary').click();
  await glsCard.getByRole('button', { name: 'Aktivovat dopravce', exact: true }).click();
  await page.getByRole('button', { name: /^Aktivní \(/ }).click();
  await visible(page.getByRole('heading', { name: 'GLS HU', exact: true }));
  assert.equal((await persisted()).carriers[0].active, true);
  await page.reload();
  await visible(page.getByRole('heading', { name: 'GLS HU', exact: true }));
  assert.equal((await persisted()).services.length, 1);
  assert.equal((await persisted()).notifications.length, 1);
  console.log('PASS: deactivate/reactivate persists and retains services and history');
  for (const mode of ['error', 'zero']) {
    await page.evaluate(mode => localStorage.setItem('crud-test-fail', mode), mode);
    await editPrice('999');
    await page.getByRole('button', { name: 'Uložit cenu' }).click();
    await visible(page.getByRole('alert'));
    await visible(page.getByText('234 Kč', { exact: true }));
    assert.equal((await persisted()).services[0].price_per_unit, 234);
    await page.getByRole('button', { name: 'Obnovit data' }).click();
  }
  console.log('PASS: rejected and zero-row writes show error and restore confirmed price');
  await page.evaluate(() => localStorage.setItem('crud-test-role', 'nonadmin'));
  glsCard = await carrierCard('GLS HU');
  await glsCard.locator('summary').click();
  await glsCard.getByRole('button', { name: 'Deaktivovat dopravce', exact: true }).click();
  await visible(page.getByRole('alert'));
  assert.equal((await persisted()).carriers[0].active, true);
  await page.getByRole('button', { name: 'Obnovit data' }).click();
  await editPrice('999');
  await page.getByRole('button', { name: 'Uložit cenu' }).click();
  await visible(page.getByRole('alert'));
  await visible(page.getByText('234 Kč', { exact: true }));
  await page.getByRole('button', { name: 'Obnovit data' }).click();
  await page.evaluate(() => localStorage.setItem('crud-test-role', 'admin'));
  await glsCard.locator('summary').click();
  await glsCard.getByTitle('Smazat dopravce').click();
  await page.getByPlaceholder('smazat').fill('smazat');
  await page.locator('div.fixed').filter({ has: page.getByRole('heading', { name: 'Potvrzení smazání' }) }).getByRole('button', { name: 'Smazat dopravce', exact: true }).click();
  await visible(page.getByRole('alert'));
  await visible(page.getByRole('heading', { name: 'GLS HU', exact: true }));
  assert.match(await page.getByRole('alert').innerText(), /historii/);
  const deleteModal = page.locator('div.fixed').filter({ has: page.getByRole('heading', { name: 'Potvrzení smazání' }) });
  await visible(deleteModal.getByRole('button', { name: 'Deaktivovat dopravce', exact: true }));
  await deleteModal.getByRole('button', { name: 'Deaktivovat dopravce', exact: true }).click();
  await page.getByRole('button', { name: /^Neaktivní \(/ }).click();
  await visible(page.getByRole('heading', { name: 'GLS HU', exact: true }));
  assert.equal((await persisted()).carriers[0].active, false);
  await page.reload();
  await page.getByRole('button', { name: /^Neaktivní \(/ }).click();
  await visible(page.getByRole('heading', { name: 'GLS HU', exact: true }));
  assert.equal((await persisted()).carriers.length, 1);
  assert.equal((await persisted()).notifications.length, 1);
  console.log('PASS: linked-history delete rejected, UI offers deactivation, history retained');
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('crud-test-db'));
    rows.carriers.push({ id: 'clean-carrier', name: 'Bez historie', logo_url: '', supported_countries: ['CZ'], active: true });
    rows.services.push({ id: 'clean-service', carrier_id: 'clean-carrier', name: 'Čistá služba', shipment_type: 'balik', price_per_unit: 90 });
    localStorage.setItem('crud-test-db', JSON.stringify(rows));
  });
  await page.reload();
  const cleanCard = await carrierCard('Bez historie');
  await cleanCard.locator('summary').click();
  await cleanCard.getByTitle('Smazat dopravce').click();
  await page.getByPlaceholder('smazat').fill('smazat');
  await page.locator('div.fixed').filter({ has: page.getByRole('heading', { name: 'Potvrzení smazání' }) }).getByRole('button', { name: 'Smazat dopravce', exact: true }).click();
  await page.getByRole('heading', { name: 'Bez historie', exact: true }).waitFor({ state: 'detached' });
  assert.equal((await persisted()).carriers.some(carrier => carrier.id === 'clean-carrier'), false);
  assert.equal((await persisted()).services.some(service => service.carrier_id === 'clean-carrier'), false);
  console.log('PASS: carrier without history is permanently deleted');
  await page.goto(`${base}/__crud-test.html?component=Products`);
  await visible(page.getByRole('heading', { name: 'Test produkt', exact: true }));
  await page.getByText('Balíky povoleny', { exact: true }).click();
  await visible(page.getByText('Balíky zakázány', { exact: true }));
  assert.equal((await persisted()).products[0].items_per_box, 11);
  await page.reload();
  await visible(page.getByText('Balíky zakázány', { exact: true }));
  await page.getByText('Balíky zakázány', { exact: true }).click();
  await visible(page.getByText('Balíky povoleny', { exact: true }));
  assert.equal((await persisted()).products[0].items_per_box, 11);
  await page.reload();
  await visible(page.getByText('Balíky povoleny', { exact: true }));
  await page.evaluate(() => localStorage.setItem('crud-test-fail', 'zero'));
  await page.getByText('Palety povoleny', { exact: true }).click();
  await visible(page.getByRole('alert'));
  await visible(page.getByText('Palety povoleny', { exact: true }));
  assert.equal((await persisted()).products[0].items_per_pallet, 22);
  console.log('PASS: product capacity roundtrip + failed toggle remains confirmed');
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('crud-test-db'));
    const carrier = rows.carriers[0];
    const service = rows.services[0];
    rows.notifications = Array.from({ length: 4 }, (_, index) => ({
      id: `notification-${index + 1}`,
      carrier_id: carrier.id,
      service_id: service.id,
      old_price: 100 + index,
      new_price: 200 + index,
      created_at: new Date(Date.now() - index * 1000).toISOString(),
      read: false
    }));
    localStorage.setItem('crud-test-db', JSON.stringify(rows));
  });
  await page.goto(`${base}/__crud-test.html?component=PriceNotification`);
  await visible(page.getByLabel('4 nepřečtených změn'));
  await page.getByRole('button', { name: 'Historie změn cen', exact: true }).click();
  await visible(page.getByRole('heading', { name: 'Historie změn cen', exact: true }));
  await page.getByLabel('4 nepřečtených změn').waitFor({ state: 'detached' });
  assert.ok((await persisted()).notifications.every(notification => notification.read));
  await page.reload();
  assert.equal(await page.locator('[aria-label$="nepřečtených změn"]').count(), 0);
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('crud-test-db'));
    rows.notifications.push({ id: 'notification-new', carrier_id: rows.carriers[0].id,
      service_id: rows.services[0].id, old_price: 234, new_price: 345,
      created_at: new Date().toISOString(), read: false });
    localStorage.setItem('crud-test-db', JSON.stringify(rows));
  });
  await page.reload();
  await visible(page.getByLabel('1 nepřečtených změn'));
  await page.getByRole('button', { name: 'Historie změn cen', exact: true }).click();
  await visible(page.getByText('345 Kč', { exact: true }));
  await visible(page.getByText('200 Kč', { exact: true }));
  await page.getByLabel('1 nepřečtených změn').waitFor({ state: 'detached' });
  await page.reload();
  assert.equal(await page.locator('[aria-label$="nepřečtených změn"]').count(), 0);
  assert.equal((await persisted()).notifications.filter(notification => !notification.read).length, 0);
  console.log('PASS: unread badge persists via RPC while full read history remains visible');
  await carrierUxAcceptance(page, base);
  await count(page.locator('vite-error-overlay'), 0);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: '/tmp/doprava-crud-ui.png', fullPage: true });
  console.log('PASS: page identity, nonblank content, no overlay, no console/page errors; /tmp/doprava-crud-ui.png');
} catch (error) { console.error('Browser errors:', errors); console.error(await page.locator('body').innerText()); throw error; } finally { await browser.close(); }
