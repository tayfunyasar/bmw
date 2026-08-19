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
// Dislanan ulke -> hedef kategori (or. LT -> LITHUANIA). UI'a hic girmezler.
const COUNTRY_EXCLUDED_CATEGORIES = LISTING_FILES.countryExcludedCategories;

// "Unfallvorschaden: Nein", "kein Vorschaden", "unfallfrei", "Accident-free" gibi
// OLUMSUZLANMIS ifadeler hasar kaniti DEGILDIR — tam tersi, hasarsizlik beyanidir.
// C264 vakasi: "Unfallvorschaden: Nein" metni salt "Vorschaden" gectigi icin
// kazali sayilmisti. Olumsuzlama iceren metin parcasi hasar sinyali uretmez.
const isNegatedDamageText = (text) =>
  /\b(nein|kein(e|en|em|er)?|ohne|unfallfrei|no)\b|accident[\s-]*free/i.test(String(text));

export function detectDamageReason(rawCar) {
  if (rawCar.isDamaged === true) return 'Apify isDamaged alanı true';
  if (typeof rawCar.isDamaged === 'string' && rawCar.isDamaged.includes('Unfallvorschaden') && !isNegatedDamageText(rawCar.isDamaged)) return `Apify isDamaged metninde tespit edildi: "${rawCar.isDamaged}"`;
  if (!!rawCar.isDamaged && typeof rawCar.isDamaged !== 'string') return 'Apify isDamaged alanı truthy';
  const vehicleCondition = rawCar.attributes?.['Vehicle condition'] || '';
  if (/accident/i.test(vehicleCondition) && !isNegatedDamageText(vehicleCondition)) return `Apify 'Vehicle condition' alanı: "${vehicleCondition}"`;
  const description = rawCar.description || '';
  const vorschadenMatch = description.match(/[^.\n]*Vorschaden[^.\n]*/i);
  if (vorschadenMatch && !isNegatedDamageText(vorschadenMatch[0])) return `İlan açıklamasında tespit edildi: "${vorschadenMatch[0].trim()}"`;
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
  // Hasar sinyali iki kaynaktan gelebilir: (1) ilanin kendi metni, (2) AYNI aracin
  // bayi sayfasindaki beyani. Bayide bilgi varken mobile.de'de yoksa bayi kazanir —
  // merge-twin.js bunu car.dealerReportedDamage'a yazar.
  const damageReason = detectDamageReason(rawCar)
    || (car.dealerReportedDamage
        ? `${car.dealerReportedDamage.source} ilanında beyan edildi: "${car.dealerReportedDamage.reason}"`
        : null);

  // Ulke dislamasi HER SEYDEN ONCE — govde/hasar/tahrike bakilmaz.
  const excludedTarget = COUNTRY_EXCLUDED_CATEGORIES[rawCar.dealer?.contry];
  if (excludedTarget) {
    return { target: excludedTarget, reason: `${rawCar.dealer.contry} ülkesinden — kapsam dışı` };
  }

  if (bodyStyle === 'CABRIO') {
    return damageReason
      ? { target: 'CABRIO_KAZALI', reason: damageReason }
      : { target: 'CABRIO' };
  }
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
