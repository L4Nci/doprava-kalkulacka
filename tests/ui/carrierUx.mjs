import assert from 'node:assert/strict';

export async function carrierUxAcceptance(page, base) {
  const persisted = () => page.evaluate(() => JSON.parse(localStorage.getItem('crud-test-db')));
  const wait = locator => locator.waitFor({ state: 'visible' });
  const card = name => page.getByRole('article', { name, exact: true });
  const tab = name => page.getByRole('button', { name: new RegExp(`^${name} \\(`) });
  const search = page.getByPlaceholder('Hledat dopravce nebo službu…');
  const type = name => page.getByRole('group', { name: 'Typ služby', exact: true }).getByRole('button', { name, exact: true });
  const reset = async () => page.getByRole('button', { name: 'Vymazat filtry', exact: true }).click();
  const state = () => page.getByRole('status').filter({ hasText: /dopravců/ });
  async function country(code) {
    const details = page.locator('details').filter({ has: page.getByRole('group', { name: 'Filtr zemí', includeHidden: true }) });
    if (!(await details.getAttribute('open') === '')) await details.locator('summary').click();
    await details.getByRole('checkbox', { name: new RegExp(`^${code} —`) }).click();
    await details.locator('summary').click();
  }
  async function results(names) {
    await page.waitForFunction(expected => JSON.stringify([...document.querySelectorAll('article > div h3')].map(n => n.textContent)) === JSON.stringify(expected), names);
  }
  async function noOverflow() {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal page scroll');
  }
  // Test-only local seed. Requests to any external host remain blocked by the caller.
  await page.goto(`${base}/__crud-test.html`);
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('crud-test-db'));
    rows.carriers = [
      { id: 'z', name: 'Žlutý dopravce', supported_countries: ['CZ','AT'], active: true, logo_url: '/icons/icon-192.png' },
      { id: 'a', name: 'Alfa', supported_countries: ['SK','RO'], active: false },
      { id: 'b', name: 'Bez služeb', supported_countries: ['RO'], active: true },
    ];
    rows.services = [
      { id: 'express', carrier_id: 'z', name: 'Express', shipment_type: 'balik', price_per_unit: 100 },
      { id: 'standard', carrier_id: 'z', name: 'Standard', shipment_type: 'paleta', price_per_unit: 900 },
      { id: 'rychla', carrier_id: 'a', name: 'Rychlá služba', shipment_type: 'paleta', price_per_unit: 800 },
    ];
    rows.notifications = [];
    localStorage.setItem('crud-test-db', JSON.stringify(rows));
  });
  await page.reload();
  await results(['Bez služeb','Žlutý dopravce']);
  assert.equal(await tab('Aktivní').innerText(), 'Aktivní (2)');
  assert.equal(await tab('Neaktivní').innerText(), 'Neaktivní (1)');
  assert.equal(await tab('Všichni').innerText(), 'Všichni (3)');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await noOverflow();
  await page.screenshot({ path: '/tmp/doprava-ux-desktop.png', fullPage: true });
  await tab('Neaktivní').click(); await results(['Alfa']);
  await tab('Všichni').click(); await results(['Alfa','Bez služeb','Žlutý dopravce']);
  await wait(card('Alfa').getByText('Neaktivní', { exact: true }));
  await search.fill('ZLUTY'); await results(['Žlutý dopravce']);
  assert.equal(await card('Žlutý dopravce').locator('tbody tr').count(), 2);
  await search.fill('RYCHLA'); await results(['Alfa']);
  await search.fill('express'); await results(['Žlutý dopravce']);
  assert.equal(await card('Žlutý dopravce').locator('tbody tr').count(), 1);
  const readsBefore = await page.evaluate(() => window.crudCalls.length);
  await type('Paleta').click(); await results([]);
  await wait(page.getByText('Žádný dopravce neodpovídá filtrům.'));
  await type('Balík').click(); await results(['Žlutý dopravce']);
  await tab('Neaktivní').click(); await results([]);
  assert.equal(await search.inputValue(), 'express');
  assert.equal(await type('Balík').getAttribute('aria-pressed'), 'true');
  await reset();
  assert.equal(await tab('Neaktivní').getAttribute('aria-pressed'), 'true');
  await results(['Alfa']);
  await tab('Všichni').click();
  await country('AT'); await results(['Žlutý dopravce']);
  await country('SK'); await results(['Alfa','Žlutý dopravce']);
  await search.fill('RYCHLA'); await type('Paleta').click(); await tab('Neaktivní').click();
  await results(['Alfa']);
  assert.equal(await state().innerText(), '1 dopravců · 1 odpovídajících služeb');
  await page.screenshot({ path: '/tmp/doprava-ux-filtered.png', fullPage: true });
  assert.equal(await page.evaluate(() => window.crudCalls.length), readsBefore, 'filtering must never fetch Supabase');
  await page.getByLabel('Řazení').selectOption('desc');
  await reset();
  assert.equal(await search.inputValue(), '');
  assert.equal(await page.getByLabel('Řazení').inputValue(), 'asc');
  assert.equal(await type('Vše').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('group', { name: 'Filtr zemí', includeHidden: true }).getByRole('checkbox', { checked: true, includeHidden: true }).count(), 0);
  await tab('Všichni').click(); await results(['Alfa','Bez služeb','Žlutý dopravce']);
  await page.getByLabel('Řazení').selectOption('desc'); await results(['Žlutý dopravce','Bez služeb','Alfa']);
  await reset();
  console.log('PASS: status/counts, carrier/service search, case/accents, country OR, type, same-service predicates, combined filters, Czech sort, reset, no filter requests');

  await tab('Aktivní').click();
  await card('Žlutý dopravce').getByTitle('Upravit dopravce').click();
  const edit = card('Žlutý dopravce');
  assert.equal(await edit.getByRole('checkbox').count(), 9);
  await edit.getByRole('checkbox', { name: 'CZ', exact: true }).uncheck();
  await edit.getByRole('checkbox', { name: 'RO', exact: true }).check();
  await edit.getByRole('checkbox', { name: 'SK', exact: true }).check();
  await page.getByLabel('Název dopravce', { exact: true }).fill('Žlutý dopravce upravený');
  await page.screenshot({ path: '/tmp/doprava-ux-countries.png', fullPage: true });
  await page.getByRole('button', { name: 'Uložit dopravce' }).click();
  await results(['Bez služeb','Žlutý dopravce upravený']);
  assert.deepEqual((await persisted()).carriers.find(c => c.id === 'z').supported_countries, ['AT','RO','SK']);
  await page.reload(); await results(['Bez služeb','Žlutý dopravce upravený']);
  await wait(card('Žlutý dopravce upravený').getByText('Podporované země: AT, RO, SK'));
  // Existing carrier gains AT through the same confirmed UPDATE path.
  await card('Bez služeb').getByTitle('Upravit dopravce').click();
  await card('Bez služeb').getByRole('checkbox', { name: 'AT', exact: true }).check();
  await page.getByRole('button', { name: 'Uložit dopravce' }).click();
  await page.getByLabel('Název dopravce', { exact: true }).waitFor({ state: 'detached' });
  await page.reload(); await results(['Bez služeb','Žlutý dopravce upravený']);
  assert.deepEqual((await persisted()).carriers.find(c => c.id === 'b').supported_countries, ['RO','AT']);
  for (const code of ['AT','RO']) {
    await page.getByRole('button', { name: 'Přidat dopravce', exact: true }).click();
    const modal = page.locator('div.fixed').filter({ has: page.getByRole('heading', { name: 'Nový dopravce' }) });
    await modal.locator('input[type=text]').first().fill(`Nový ${code}`);
    await modal.getByRole('checkbox', { name: code, exact: true }).check();
    await modal.getByPlaceholder('Název služby').fill(`Služba ${code}`);
    await modal.getByPlaceholder('Cena', { exact: true }).fill('150');
    await modal.getByRole('button', { name: 'Vytvořit dopravce' }).click();
    await wait(card(`Nový ${code}`));
    await page.reload(); await wait(card(`Nový ${code}`));
    assert.deepEqual((await persisted()).carriers.find(c => c.name === `Nový ${code}`).supported_countries, [code]);
  }
  console.log('PASS: CREATE AT/RO, edit name/countries, add AT/RO, remove CZ, confirmed persistence across reload');
  const serviceRow = () => card('Žlutý dopravce upravený').locator('tbody tr').first();
  await serviceRow().getByTitle('Upravit název služby').click();
  await page.getByLabel('Název služby', { exact: true }).fill('Nový Express');
  await page.getByRole('button', { name: 'Uložit název služby' }).click();
  await wait(page.getByText('Nový Express', { exact: true }));
  assert.equal((await persisted()).notifications.length, 0);
  await serviceRow().getByTitle('Změnit typ přepravy').click();
  await page.getByLabel('Typ přepravy', { exact: true }).selectOption('paleta');
  await page.getByLabel('Typ přepravy', { exact: true }).waitFor({ state: 'detached' });
  assert.equal((await persisted()).notifications.length, 0);
  await serviceRow().getByTitle('Upravit cenu').click();
  await page.getByLabel('Cena služby').fill('123');
  await page.getByLabel('Cena služby').press('Enter');
  await wait(page.getByText('123', { exact: true }));
  assert.equal((await persisted()).notifications.length, 1);
  await page.reload(); await wait(page.getByText('Nový Express', { exact: true }));
  await wait(page.getByText('123', { exact: true }));
  assert.equal((await persisted()).services.find(s => s.id === 'express').shipment_type, 'paleta');
  console.log('PASS: existing service name/type/price flow persists; only price generates history (also verified in real local DB suite)');

  await page.setViewportSize({ width: 1024, height: 768 }); await noOverflow();
  await page.screenshot({ path: '/tmp/doprava-ux-notebook.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
  await card('Žlutý dopravce upravený').getByTitle('Upravit dopravce').click(); await noOverflow();
  await page.screenshot({ path: '/tmp/doprava-ux-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Scaling fixtures stay entirely in the isolated test transport.
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('crud-test-db'));
    for (let i = rows.carriers.length; i < 100; i++) rows.carriers.push({ id: `bulk-${i}`, name: `Dopravce ${i}`, active: true, supported_countries: ['CZ'], services: [] });
    localStorage.setItem('crud-test-db', JSON.stringify(rows));
  });
  await page.reload(); await wait(tab('Aktivní'));
  await search.fill('Dopravce 99'); await results(['Dopravce 99']);
  await reset();
  assert.equal(await page.getByRole('article').count(), 99);
  await noOverflow();
  console.log('PASS: desktop/notebook/mobile layout, no page overflow, filtering 100 carriers');
}
