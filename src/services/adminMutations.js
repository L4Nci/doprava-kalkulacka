// No credentials or global client: the same contract is tested with an offline client.
const unconfirmed = () => new Error('Databáze změnu nepotvrdila. Obnovte data a zkontrolujte oprávnění.');

function one(result) {
  if (result.error) throw result.error;
  const rows = Array.isArray(result.data) ? result.data : [result.data];
  if (rows.length !== 1 || !rows[0]?.id) throw unconfirmed();
  return rows[0];
}

function matches(row, expected) {
  return Object.entries(expected).every(([key, value]) =>
    JSON.stringify(row[key]) === JSON.stringify(value));
}

export function positiveInteger(value, label, minimum = 1) {
  const number = Number(value);
  if (value === null || String(value).trim() === '' || !Number.isSafeInteger(number) || number < minimum || number > 2147483647) {
    throw new Error(`${label}: zadejte celé číslo od ${minimum} do 2147483647.`);
  }
  return number;
}

export function productPatch(current, updates) {
  const patch = { ...updates };
  for (const key of ['items_per_box', 'items_per_pallet', 'boxes_per_item']) {
    if (Object.hasOwn(patch, key)) patch[key] = positiveInteger(patch[key], 'Kapacita');
  }
  if (Object.hasOwn(patch, 'name')) {
    patch.name = patch.name.trim();
    if (!patch.name) throw new Error('Vyplňte název produktu.');
  }
  const next = { ...current, ...patch };
  if (next.parcel_disabled && next.pallet_disabled) throw new Error('Nelze zakázat všechny způsoby dopravy.');
  // Flags never erase the NOT NULL capacities.
  return patch;
}

export function mutationError(error) {
  if (error?.code === 'PGRST116') return 'Databáze nepotvrdila změnu jednoho záznamu. Obnovte data a zkontrolujte oprávnění.';
  if (error?.code === '23503') return 'Záznam má navázaná data a nelze jej smazat. Data nebyla odstraněna.';
  if (error?.code === '42501') return 'Nemáte oprávnění k zápisu. Změna nebyla uložena.';
  return `${error?.message || 'Síťová chyba.'} Stav není potvrzený; před opakováním obnovte data.`;
}

export function createAdminMutations(client) {
  async function read(table, id, selection = '*') {
    return one(await client.from(table).select(selection).eq('id', id).single());
  }
  return {
    async insert(table, values) {
      const saved = one(await client.from(table).insert(values).select('*').single());
      const verified = await read(table, saved.id);
      if (!matches(saved, values) || !matches(verified, values)) throw unconfirmed();
      return verified;
    },
    async update(table, id, values) {
      const saved = one(await client.from(table).update(values).eq('id', id).select('*').single());
      const verified = await read(table, id);
      if (saved.id !== id || !matches(saved, values) || !matches(verified, values)) throw unconfirmed();
      return verified;
    },
    async remove(table, id) {
      const removed = one(await client.from(table).delete().eq('id', id).select('id').single());
      if (removed.id !== id) throw unconfirmed();
      const check = await client.from(table).select('id').eq('id', id).maybeSingle();
      if (check.error) throw check.error;
      if (check.data !== null) throw unconfirmed();
      return removed;
    },
    async createCarrier(draft) {
      const name = draft.name.trim();
      if (!name || !draft.services.length || !draft.supported_countries.length) {
        throw new Error('Vyplňte název dopravce, zemi a alespoň jednu službu.');
      }
      const services = draft.services.map(service => {
        if (!service.name.trim() || !['balik', 'paleta'].includes(service.shipment_type)) throw new Error('Vyplňte službu a typ přepravy.');
        return { name: service.name.trim(), shipment_type: service.shipment_type,
          price_per_unit: positiveInteger(service.price_per_unit, 'Cena', 0) };
      });
      const values = { name, logo_url: draft.logo_url, supported_countries: draft.supported_countries };
      const saved = one(await client.rpc('create_carrier_with_services', { carrier_data: values, service_data: services }));
      const verified = await read('carriers', saved.id, '*, services(*)');
      if (!matches(verified, values) || verified.services?.length !== services.length) throw unconfirmed();
      const remaining = [...verified.services];
      for (const service of services) {
        const index = remaining.findIndex(row => matches(row, service));
        if (index < 0) throw unconfirmed();
        remaining.splice(index, 1);
      }
      return verified;
    }
  };
}
