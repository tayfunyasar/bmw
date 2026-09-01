// BMW VIN'inin 4-7. karakterindeki fabrika tip kodunu tek yerde cozer.
// Govde tipi ve tahrik ayni kimlik tablosunu kullanir; ilan metniyle celisen
// bilinen bir tip kodu her zaman fabrika verisi olarak onceliklidir.

import VIN_TYPE_CODES_JSON from '../../src/data/metadata/VIN_TYPE_CODES.json' with { type: 'json' };

const VIN_TYPE_CODES = VIN_TYPE_CODES_JSON.codes;

export const typeCodeFromVin = (vin) =>
  (typeof vin === 'string' && vin.length >= 7) ? vin.slice(3, 7).toUpperCase() : null;

export function vehicleIdentityFromVin(vin) {
  const typeCode = typeCodeFromVin(vin);
  if (!typeCode) return null;
  const identity = VIN_TYPE_CODES[typeCode];
  return identity ? { typeCode, ...identity } : null;
}
