// Browser-only transport double. Never imported by the application build.
const seed = { carriers: [], services: [], notifications: [], products: [{ id: 'p1', name: 'Test produkt', code: 'fixture', image_url: '/icons/icon-192.png', items_per_box: 11, items_per_pallet: 22, boxes_per_item: 1, parcel_disabled: false, pallet_disabled: false, multiple_boxes: false }] };
function db() { return JSON.parse(localStorage.getItem('crud-test-db') || JSON.stringify(seed)); }
function store(data) { localStorage.setItem('crud-test-db', JSON.stringify(data)); }
function role() { return localStorage.getItem('crud-test-role') || 'admin'; }
window.crudCalls = [];
function query(table) {
  let action = 'select', values, selected = '*', single = false, head = false, count, limitValue;
  const filters = [];
  const chain = {
    select(fields = '*', options = {}) { selected = fields; head = Boolean(options.head); count = options.count; return chain; },
    order(column, options = {}) { chain.orderBy = { column, ascending: options.ascending !== false }; return chain; },
    limit(value) { limitValue = value; return chain; },
    eq(key, value) { filters.push([key, value]); return chain; },
    insert(data) { action = 'insert'; values = data; return chain; },
    update(data) { action = 'update'; values = data; return chain; },
    delete() { action = 'delete'; return chain; },
    single() { single = true; return chain; },
    maybeSingle() { single = true; return chain; },
    async then(resolve) {
      window.crudCalls.push({ table, action, values });
      await new Promise(r => setTimeout(r, 70));
      const rows = db();
      let result = rows[table].filter(row => filters.every(([key, value]) => row[key] === value));
      const fail = localStorage.getItem('crud-test-fail');
      if (action !== 'select' && (role() !== 'admin' || fail)) {
        localStorage.removeItem('crud-test-fail');
        return resolve(fail === 'zero' ? { data: [], error: null } : { data: null, error: { code: '42501', message: 'RLS denied' } });
      }
      if (action === 'insert') {
        result = [{ ...values, id: crypto.randomUUID() }]; rows[table].push(...result);
      } else if (action === 'update') {
        const previous = result;
        result = result.map(row => ({ ...row, ...values }));
        rows[table] = rows[table].map(row => result.find(r => r.id === row.id) || row);
        if (table === 'services' && Object.hasOwn(values, 'price_per_unit')) {
          for (const before of previous) rows.notifications.push({
            id: crypto.randomUUID(), carrier_id: before.carrier_id, service_id: before.id,
            old_price: before.price_per_unit, new_price: values.price_per_unit
          });
        }
      } else if (action === 'delete') {
        if (table === 'carriers') {
          const carrierId = result[0]?.id;
          const serviceIds = rows.services.filter(row => row.carrier_id === carrierId).map(row => row.id);
          if (rows.notifications.some(row => row.carrier_id === carrierId || serviceIds.includes(row.service_id))) {
            return resolve({ data: null, error: { code: '23503', message: 'foreign key violation' } });
          }
        }
        const removedIds = new Set(result.map(row => row.id));
        rows[table] = rows[table].filter(row => !removedIds.has(row.id));
        if (table === 'carriers') rows.services = rows.services.filter(row => !removedIds.has(row.carrier_id));
      }
      if (action !== 'select') store(rows);
      if (table === 'carriers' && selected.includes('services')) result = result.map(row => ({ ...row, services: rows.services.filter(s => s.carrier_id === row.id) }));
      if (table === 'notifications') result = result.map(row => ({ ...row,
        carriers: rows.carriers.find(carrier => carrier.id === row.carrier_id) || null,
        services: rows.services.find(service => service.id === row.service_id) || null
      }));
      if (chain.orderBy) result.sort((a, b) => {
        const comparison = String(a[chain.orderBy.column]).localeCompare(String(b[chain.orderBy.column]));
        return chain.orderBy.ascending ? comparison : -comparison;
      });
      const exactCount = result.length;
      if (limitValue !== undefined) result = result.slice(0, limitValue);
      return resolve({ data: head ? null : (single ? result[0] || null : result), error: null,
        count: count === 'exact' ? exactCount : null });
    }
  };
  return chain;
}
export const supabase = {
  from(table) { return query(table === 'price_change_notifications' ? 'notifications' : table); },
  auth: { getSession: async () => ({ data: { session: { access_token: 'offline-test' } } }) },
  channel() {
    return { on() { return this; }, subscribe() { return this; }, unsubscribe() {} };
  },
  async rpc(name, args) {
    window.crudCalls.push({ action: 'rpc' });
    await new Promise(r => setTimeout(r, 150));
    if (role() !== 'admin') return { data: null, error: { code: '42501', message: 'RLS denied' } };
    if (name === 'mark_price_change_notifications_read') {
      const rows = db(), ids = new Set(args.notification_ids);
      const changed = [];
      rows.notifications = rows.notifications.map(notification => {
        if (!ids.has(notification.id) || notification.read) return notification;
        changed.push({ notification_id: notification.id });
        return { ...notification, read: true };
      });
      store(rows);
      return { data: changed, error: null };
    }
    const { carrier_data, service_data } = args;
    const rows = db(), carrier = { active: true, ...carrier_data, id: crypto.randomUUID() };
    rows.carriers.push(carrier);
    rows.services.push(...service_data.map(s => ({ ...s, id: crypto.randomUUID(), carrier_id: carrier.id })));
    store(rows);
    return { data: [carrier], error: null };
  }
};
