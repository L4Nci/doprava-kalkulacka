import assert from 'node:assert/strict';

// Same user flow as production, using the offline transport installed by run.mjs.
export async function changeHistoryAcceptance(page, base) {
  const visible = locator => locator.waitFor({ state: 'visible' });
  const absent = locator => locator.waitFor({ state: 'detached' });
  const bell = () => page.getByRole('button', { name: 'Historie změn', exact: true });
  const panel = () => page.getByRole('dialog', { name: 'Historie změn', exact: true });
  const card = name => page.getByRole('article', { name, exact: true });
  const persisted = () => page.evaluate(() => JSON.parse(localStorage.getItem('crud-test-db')));
  const close = () => page.getByRole('button', { name: 'Zavřít historii změn', exact: true }).click();
  const open = async () => { await bell().click(); await visible(panel()); };
  const tab = name => page.getByRole('button', { name: new RegExp(`^${name} \\(`) });
  const expectEvents = async expected => {
    assert.deepEqual((await persisted()).notifications.map(notification => notification.event_type), expected);
  };
  const noOverflow = async () => {
    const bounds = await panel().boundingBox();
    const viewport = page.viewportSize();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width, 'history stays inside viewport horizontally');
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= viewport.height, 'history stays inside viewport vertically');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal page overflow');
  };

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/__crud-test.html?component=HistoryWithCourier`);
  await visible(page.getByRole('heading', { name: 'Dopravci', exact: true }));
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('crud-test-db'));
    rows.carriers = []; rows.services = []; rows.notifications = [];
    localStorage.removeItem('crud-test-fail');
    localStorage.setItem('crud-test-db', JSON.stringify(rows));
  });
  await page.reload();
  await open();
  await visible(panel().getByText(/Žádná historie změn|Zatím žádné změny/));
  await page.keyboard.press('Escape');
  await absent(panel());
  assert.equal(await bell().getAttribute('aria-expanded'), 'false');

  await page.getByRole('button', { name: 'Přidat dopravce', exact: true }).click();
  const modal = page.locator('div.fixed').filter({ has: page.getByRole('heading', { name: 'Nový dopravce', exact: true }) });
  await modal.locator('input[type=text]').first().fill('GLS CZ');
  await modal.getByRole('checkbox', { name: 'CZ', exact: true }).check();
  await modal.getByPlaceholder('Název služby').fill('Balík do 20 kg');
  await modal.getByPlaceholder('Cena', { exact: true }).fill('320');
  await modal.getByRole('button', { name: 'Vytvořit dopravce' }).click();
  await visible(card('GLS CZ'));
  await expectEvents(['carrier_added']);
  await visible(page.getByLabel('1 nepřečtených změn', { exact: true }));
  await open();
  await visible(panel().getByText('Nový dopravce', { exact: true }));
  await visible(panel().getByText('GLS CZ', { exact: true }));
  assert.ok(!(await panel().innerText()).includes('Kč'), 'lifecycle events do not display empty prices');
  await absent(page.getByLabel('1 nepřečtených změn', { exact: true }));
  await close();

  await card('GLS CZ').locator('summary').click();
  await card('GLS CZ').getByRole('button', { name: 'Deaktivovat dopravce', exact: true }).click();
  await tab('Neaktivní').click();
  await visible(card('GLS CZ'));
  await expectEvents(['carrier_added', 'carrier_deactivated']);
  await page.reload();
  await open();
  await visible(panel().getByText('Dopravce deaktivován', { exact: true }));
  await visible(panel().getByText('Nový dopravce', { exact: true }));
  await close();
  await tab('Neaktivní').click();
  await card('GLS CZ').locator('summary').click();
  await card('GLS CZ').getByRole('button', { name: 'Aktivovat dopravce', exact: true }).click();
  await tab('Aktivní').click();
  await visible(card('GLS CZ'));
  await expectEvents(['carrier_added', 'carrier_deactivated', 'carrier_activated']);

  await card('GLS CZ').getByTitle('Upravit dopravce').click();
  await page.getByLabel('Název dopravce', { exact: true }).fill('GLS Česká republika');
  await page.getByRole('button', { name: 'Uložit dopravce' }).click();
  await visible(card('GLS Česká republika'));
  await expectEvents(['carrier_added', 'carrier_deactivated', 'carrier_activated']);
  assert.equal((await persisted()).notifications[0].carrier_name, 'GLS CZ', 'lifecycle keeps the name at the time of the event');

  await card('GLS Česká republika').getByTitle('Upravit cenu').click();
  await page.getByLabel('Cena služby', { exact: true }).fill('345');
  await page.getByRole('button', { name: 'Uložit cenu', exact: true }).click();
  await visible(card('GLS Česká republika').getByText('345 Kč', { exact: true }));
  await expectEvents(['carrier_added', 'carrier_deactivated', 'carrier_activated', 'price_changed']);
  await page.evaluate(() => localStorage.setItem('crud-test-fail', 'error'));
  await card('GLS Česká republika').locator('summary').click();
  await card('GLS Česká republika').getByRole('button', { name: 'Deaktivovat dopravce', exact: true }).click();
  await visible(page.getByRole('alert'));
  await expectEvents(['carrier_added', 'carrier_deactivated', 'carrier_activated', 'price_changed']);
  await page.getByRole('button', { name: 'Obnovit data', exact: true }).click();
  await absent(page.getByRole('alert'));
  await open();
  for (const label of ['Dopravce aktivován', 'Dopravce deaktivován', 'Nový dopravce', 'Změna ceny']) {
    await visible(panel().getByText(label, { exact: true }));
  }
  await visible(panel().getByText('320 Kč', { exact: true }));
  await visible(panel().getByText('345 Kč', { exact: true }));
  await noOverflow();
  await absent(page.locator('[aria-label$="nepřečtených změn"]'));
  await page.screenshot({ path: '/tmp/doprava-history-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({ path: '/tmp/doprava-history-mobile.png', fullPage: false });
  await close();
  await page.setViewportSize({ width: 1280, height: 900 });
  await open();
  await page.getByRole('heading', { name: 'Dopravci', exact: true }).click();
  await absent(panel());
  console.log('PASS: create/deactivate/reactivate + price change flow is reflected in persistent mixed history; rejected writes and name edits add no events; Escape/close/outside click; desktop/mobile no clipping');

  // A legacy price row has no event_type; no data rewrite is needed to render it.
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('crud-test-db'));
    rows.notifications.push({ id: 'legacy-price', carrier_id: rows.carriers[0].id,
      service_id: rows.services[0].id, old_price: 345, new_price: 400,
      created_at: new Date().toISOString(), read: false });
    localStorage.setItem('crud-test-db', JSON.stringify(rows));
    localStorage.setItem('crud-test-notification-mark-fail', 'true');
  });
  await page.reload();
  await open();
  await visible(panel().getByRole('alert'));
  await visible(panel().getByText('400 Kč', { exact: true }));
  assert.equal((await persisted()).notifications.find(row => row.id === 'legacy-price').read, false, 'failed mark does not hide the unread event');
  await close();
  await page.evaluate(() => localStorage.removeItem('crud-test-notification-mark-fail'));
  await open();
  await absent(panel().getByRole('alert'));
  await absent(page.locator('[aria-label$="nepřečtených změn"]'));
  assert.equal((await persisted()).notifications.find(row => row.id === 'legacy-price').read, true);
  await close();
  await page.evaluate(() => localStorage.setItem('crud-test-notification-read-fail', 'true'));
  await page.reload();
  await open();
  await visible(panel().getByRole('alert'));
  await close();
  await page.evaluate(() => localStorage.removeItem('crud-test-notification-read-fail'));
  await open();
  await visible(panel().getByText('400 Kč', { exact: true }));
  await absent(panel().getByRole('alert'));
  await close();
  console.log('PASS: legacy price history, failed mark/read recovery, persisted unread state');

  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('crud-test-db'));
    rows.notifications = Array.from({ length: 12 }, (_, index) => ({ id: `recent-${index}`,
      event_type: 'carrier_added', carrier_name: `Přeprava ${index}`,
      carrier_id: null, service_id: null, old_price: null, new_price: null,
      created_at: new Date(Date.now() - index * 1000).toISOString(), read: false }));
    localStorage.setItem('crud-test-db', JSON.stringify(rows));
  });
  await page.reload();
  await visible(page.getByLabel('12 nepřečtených změn', { exact: true }));
  await open();
  await visible(panel().getByText('Přeprava 0', { exact: true }));
  assert.equal(await panel().getByText(/^Přeprava \d+$/).count(), 10);
  assert.equal(await panel().getByText('Přeprava 10', { exact: true }).count(), 0);
  await visible(page.getByLabel('2 nepřečtených změn', { exact: true }));
  assert.equal((await persisted()).notifications.filter(notification => !notification.read).length, 2, 'only the ten displayed rows are marked read');
  await close();
  await page.reload();
  await visible(page.getByLabel('2 nepřečtených změn', { exact: true }));
  assert.equal(await page.title(), 'Offline CRUD acceptance');
  assert.ok(page.url().startsWith(base));
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  console.log('PASS: ten newest events displayed, unread count includes older undisplayed events; history screenshots in /tmp/doprava-history-{desktop,mobile}.png');
}
