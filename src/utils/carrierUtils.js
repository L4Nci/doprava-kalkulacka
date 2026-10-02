export function activeCarriers(carriers) {
  return carriers.filter(carrier => carrier.active === true);
}
