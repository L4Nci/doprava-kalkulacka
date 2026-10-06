import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCarriers } from '../src/utils/carrierFilters.js';
import { COUNTRIES, COUNTRY_NAMES } from '../src/config/countries.js';

const carriers = [
  { id: 'z', name: 'Žlutý dopravce', active: true, supported_countries: ['CZ', 'AT'], services: [
    { name: 'Express', shipment_type: 'balik', price_per_unit: 100 }, { name: 'Standard', shipment_type: 'paleta', price_per_unit: 900 }] },
  { id: 'a', name: 'Alfa', active: false, supported_countries: ['SK', 'RO'], services: [{ name: 'Rychlá služba', shipment_type: 'paleta', price_per_unit: 800 }] },
  { id: 'b', name: 'Bez služeb', active: true, supported_countries: ['RO'], services: [] },
];
const ids = filters => filterCarriers(carriers, filters).map(carrier => carrier.id);
test('canonical nine countries include Austria and Romania', () => {
  assert.deepEqual(COUNTRIES.map(country => country.code), ['CZ', 'SK', 'PL', 'HU', 'DE', 'HR', 'SI', 'AT', 'RO']);
  assert.equal(COUNTRY_NAMES.AT, 'Rakousko'); assert.equal(COUNTRY_NAMES.RO, 'Rumunsko');
});
test('status defaults active and keeps service-less carriers', () => {
  assert.deepEqual(ids({}), ['b', 'z']);
  assert.deepEqual(ids({ status: 'inactive' }), ['a']);
  assert.deepEqual(ids({ status: 'all' }), ['a', 'b', 'z']);
});
test('search ignores case and accents on carrier and service names', () => {
  assert.deepEqual(ids({ search: ' ZLUTY ' }), ['z']);
  assert.equal(filterCarriers(carriers, { search: 'zluty' })[0].services.length, 2);
  assert.deepEqual(ids({ status: 'all', search: 'RYCHLA SLUZBA' }), ['a']);
  assert.deepEqual(filterCarriers(carriers, { search: 'express' })[0].services.map(s => s.name), ['Express']);
});
test('countries use OR, combined with status and service filters using AND', () => {
  assert.deepEqual(ids({ countries: ['AT'] }), ['z']);
  assert.deepEqual(ids({ status: 'all', countries: ['CZ', 'SK'] }), ['a', 'z']);
  assert.deepEqual(ids({ status: 'inactive', countries: ['RO', 'CZ'], type: 'paleta', search: 'rychla' }), ['a']);
  assert.deepEqual(ids({ status: 'active', countries: ['SK'], type: 'paleta' }), []);
});
test('type and search must match the same service', () => {
  assert.deepEqual(ids({ search: 'Express', type: 'paleta' }), []);
  assert.deepEqual(ids({ search: 'Express', type: 'balik' }), ['z']);
  assert.deepEqual(filterCarriers(carriers, { search: 'zluty', type: 'paleta' })[0].services.map(s => s.name), ['Standard']);
  assert.deepEqual(ids({ type: 'paleta' }), ['z']);
  assert.deepEqual(ids({ search: 'bez', type: 'balik' }), []);
});
test('Czech sorting in both directions; fetched rows stay intact', () => {
  const before = structuredClone(carriers);
  assert.deepEqual(ids({ status: 'all', sort: 'desc' }), ['z', 'b', 'a']);
  assert.deepEqual(carriers, before);
  const names = ['I', 'Ch', 'H'].map(name => ({ name, active: true }));
  assert.deepEqual(filterCarriers(names).map(c => c.name), ['H', 'Ch', 'I']);
});
test('price sorting uses the lowest currently matching service price', () => {
  const priced = [
    { id: 'alpha', name: 'Áčko', active: true, services: [
      { name: 'Express', shipment_type: 'balik', price_per_unit: 100 },
      { name: 'Paleta', shipment_type: 'paleta', price_per_unit: 800 },
    ] },
    { id: 'beta', name: 'Béčko', active: true, services: [
      { name: 'Standard', shipment_type: 'balik', price_per_unit: 200 },
      { name: 'Express paleta', shipment_type: 'paleta', price_per_unit: 700 },
    ] },
  ];
  const sorted = filters => filterCarriers(priced, filters).map(carrier => carrier.id);
  assert.deepEqual(sorted({ sort: 'price-asc' }), ['alpha', 'beta']);
  assert.deepEqual(sorted({ sort: 'price-desc' }), ['beta', 'alpha']);
  assert.deepEqual(sorted({ type: 'paleta', sort: 'price-asc' }), ['beta', 'alpha']);
  assert.deepEqual(sorted({ type: 'balik', sort: 'price-desc' }), ['beta', 'alpha']);
  assert.deepEqual(sorted({ search: 'express', sort: 'price-desc' }), ['beta', 'alpha']);
});
test('price ties use Czech names and missing prices always sort last', () => {
  const priced = [
    { id: 'z', name: 'Žofie', active: true, services: [{ name: 'A', shipment_type: 'balik', price_per_unit: 100 }] },
    { id: 'c', name: 'Čenda', active: true, services: [{ name: 'B', shipment_type: 'balik', price_per_unit: '100' }] },
    { id: 'empty', name: 'Bez služby', active: true, services: [] },
    { id: 'invalid', name: 'Bez ceny', active: true, services: [{ name: 'C', shipment_type: 'balik', price_per_unit: null }] },
  ];
  const sorted = sort => filterCarriers(priced, { sort }).map(carrier => carrier.id);
  assert.deepEqual(sorted('price-asc'), ['c', 'z', 'invalid', 'empty']);
  assert.deepEqual(sorted('price-desc'), ['c', 'z', 'invalid', 'empty']);
});
