// Bir aracin hangi kategori dosyasina gidecegini belirler (tek kaynak).
// Oncelik: ulke-dislama > cabrio > gran coupe > hasar > dizel > RWD > sunroof.
// Hem parse-car-json.js (mobile.de) hem import-dealer.js (bayi) bunu kullanir.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyBodyStyle, rawCarToTextObj, rawCarApifyCategory } from './body-style.js';
import { determineDrivetrainFromRaw, RWD } from './drivetrain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTING_FILES = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/data/metadata/LISTING_FILES.json'), 'utf8'));
// Dislanan ulke -> hedef dosya (or. LT -> LITHUANIA.json). UI'a hic girmezler.
const COUNTRY_EXCLUDED_FILES = LISTING_FILES.countryExcludedFiles;

export function detectDamageReason(rawCar) {
  if (rawCar.isDamaged === true) return 'Apify isDamaged alanı true';
  if (typeof rawCar.isDamaged === 'string' && rawCar.isDamaged.includes('Unfallvorschaden')) return `Apify isDamaged metninde tespit edildi: "${rawCar.isDamaged}"`;
  if (!!rawCar.isDamaged && typeof rawCar.isDamaged !== 'string') return 'Apify isDamaged alanı truthy';
  const vehicleCondition = rawCar.attributes?.['Vehicle condition'] || '';
  if (vehicleCondition.includes('accident')) return `Apify 'Vehicle condition' alanı: "${vehicleCondition}"`;
  const description = rawCar.description || '';
  const vorschadenMatch = description.match(/[^.\n]*Vorschaden[^.\n]*/i);
  if (vorschadenMatch) return `İlan açıklamasında tespit edildi: "${vorschadenMatch[0].trim()}"`;
  return null;
}

// car: parse edilmis listing (overrideFeatures + equipmentFeatures + vin okunur)
// rawCar: ham kayit (body-style/hasar/yakit sinyalleri icin)
export function determineTargetFile(car, rawCar) {
  const overrides = car.overrideFeatures || {};
  const isSunroof = car.equipmentFeatures.S403A === "yes";
  // VIN varsa Kural 0 devrede — parse asamasiyla ayni sonuc.
  const driveResult = determineDrivetrainFromRaw(rawCar, car.vin || '');
  const driveOverride = overrides.drivetrainType?.value || overrides.drivetrainType;
  const isRWD = driveOverride === RWD || driveResult.type === RWD;
  const textObj = rawCarToTextObj(rawCar);
  const apifyCategory = rawCarApifyCategory(rawCar);
  const bodyStyle = classifyBodyStyle(textObj, { apifyCategory });
  const isDiesel = (rawCar.properties?.fuelType || "").toLowerCase().includes("diesel") || /m440d/i.test(rawCar.title || "");
  const damageReason = detectDamageReason(rawCar);

  // Ulke dislamasi HER SEYDEN ONCE — govde/hasar/tahrike bakilmaz.
  const excludedTarget = COUNTRY_EXCLUDED_FILES[rawCar.dealer?.contry];
  if (excludedTarget) {
    return { target: excludedTarget.replace(/\.json$/, ''), reason: `${rawCar.dealer.contry} ülkesinden — kapsam dışı` };
  }

  if (bodyStyle === 'CABRIO') return { target: 'CABRIO' };
  if (bodyStyle === 'GRAN_COUPE') {
    return damageReason
      ? { target: 'GRAN_COUPE_KAZALI', reason: damageReason }
      : { target: 'GRAN_COUPE' };
  }
  if (damageReason) return { target: 'COUPE_GAS_WITH_SUNROOF_KAZALI', reason: damageReason };
  if (isDiesel) return { target: 'COUPE_DIESEL_WITH_SUNROOF' };
  if (isRWD) return { target: isSunroof ? 'COUPE_GAS_RWD_WITH_SUNROOF' : 'COUPE_GAS_RWD_WITHOUT_SUNROOF' };
  return { target: isSunroof ? 'COUPE_GAS_WITH_SUNROOF' : 'COUPE_GAS_WITHOUT_SUNROOF' };
}
