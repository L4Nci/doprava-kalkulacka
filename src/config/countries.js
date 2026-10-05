export const COUNTRIES = Object.freeze([
  { code: 'CZ', name: 'Česko' },
  { code: 'SK', name: 'Slovensko' },
  { code: 'PL', name: 'Polsko' },
  { code: 'HU', name: 'Maďarsko' },
  { code: 'DE', name: 'Německo' },
  { code: 'HR', name: 'Chorvatsko' },
  { code: 'SI', name: 'Slovinsko' },
  { code: 'AT', name: 'Rakousko' },
  { code: 'RO', name: 'Rumunsko' },
]);

export const COUNTRY_NAMES = Object.freeze(Object.fromEntries(COUNTRIES.map(({ code, name }) => [code, name])));
