const RATES = { DE: 19, FR: 20, ES: 21 };
export function vat(cents, country) {
  return Math.round((cents * RATES[country]) / 100);
}
