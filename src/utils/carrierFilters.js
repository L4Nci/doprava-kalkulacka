const collator = new Intl.Collator('cs', { sensitivity: 'base', numeric: true });
const normalize = value => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('cs').trim();

// All service-level predicates are evaluated on the same service. Never mutate fetched rows.
export function filterCarriers(carriers, { status = 'active', search = '', countries = [], type = 'all', sort = 'asc' } = {}) {
  const query = normalize(search);
  return carriers.flatMap(carrier => {
    if (status !== 'all' && Boolean(carrier.active) !== (status === 'active')) return [];
    if (countries.length && !countries.some(country => carrier.supported_countries?.includes(country))) return [];
    const carrierMatches = normalize(carrier.name).includes(query);
    const services = (carrier.services || []).filter(service =>
      (type === 'all' || service.shipment_type === type) &&
      (carrierMatches || normalize(service.name).includes(query)));
    if (!services.length && (type !== 'all' || !carrierMatches)) return [];
    return [{ ...carrier, services }];
  }).sort((a, b) => (sort === 'desc' ? -1 : 1) * collator.compare(a.name, b.name));
}
