// Bir aracin hangi kategori dosyasina gidecegini belirler (tek kaynak).
// Oncelik: ulke-dislama > cabrio > gran coupe > hasar > dizel > RWD > sunroof.
// Hem parse-car-json.js (mobile.de) hem import-dealer.js (bayi) bunu kullanir.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { determineBodyStyle, rawCarToTextObj, rawCarApifyCategory } from './body-style.js';
import { determineDrivetrainFromRaw, RWD } from './drivetrain.js';
// Hasar kelime tablolari + agir-hasar satici listesi config'te: TEXT_SIGNALS.json → damage.
import { TEXT_SIGNALS } from './text-signals.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTING_FILES = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/data/metadata/LISTING_FILES.json'), 'utf8'));
// Dislanan ulke -> hedef kategori (or. LT -> LITHUANIA). UI'a hic girmezler.
const COUNTRY_EXCLUDED_CATEGORIES = LISTING_FILES.countryExcludedCategories;

// "Unfallvorschaden: Nein", "kein Vorschaden", "unfallfrei", "Accident-free",
// "schadevrij" (NL) gibi OLUMSUZLANMIS ifadeler hasar kaniti DEGILDIR — tam tersi,
// hasarsizlik beyanidir. C264 vakasi: "Unfallvorschaden: Nein" metni salt "Vorschaden"
// gectigi icin kazali sayilmisti. Olumsuzlama iceren metin parcasi hasar sinyali uretmez.
// Kelime listesi config'te (TEXT_SIGNALS.json → damage.negationWords, DE+EN+NL).
const NEGATION_RE = new RegExp(`\\b(${TEXT_SIGNALS.damage.negationWords.join('|')})\\b`, 'i');
const isNegatedDamageText = (text) => NEGATION_RE.test(String(text));
// Aciklama metninde hasar kaniti sayilan kelimeler — liste config'te (TEXT_SIGNALS.json
// → damage.words; dar tutulur ki "Unfalldatenschreiber" gibi donanim adlari yakalanmasin).
// Eslesen CUMLE PARCASI dondurulur (nokta/satir sonuna kadar) — audit gerekcesine yazilir.
const DAMAGE_WORDS = new RegExp(`[^.\\n]*(${TEXT_SIGNALS.damage.words.join('|')})[^.\\n]*`, 'i');

// Bu saticilar yalniz kazali arac ticareti yapiyor. Ilan metni hasari acikca
// yazmasa bile satici politikasi hem KAZALI yonlendirmesini hem de UI'da gizlenen
// "major" seviyesini zorunlu kilar.
const MAJOR_DAMAGE_SELLERS = TEXT_SIGNALS.damage.majorSellers;
const normalizedSellerName = (rawCar, car = {}) =>
  String(rawCar?.dealer?.name || car.sellerTypeOrName || '').toLocaleLowerCase('de-DE');

export function sellerDamagePolicy(rawCar, car = {}) {
  const seller = normalizedSellerName(rawCar, car);
  const matched = MAJOR_DAMAGE_SELLERS.find(name => seller.includes(name));
  return matched
    ? { severity: 'major', reason: `Satıcı politikası: "${rawCar?.dealer?.name || car.sellerTypeOrName}" yalnız ağır hasarlı araç olarak değerlendirilir` }
    : null;
}

export function detectDamageReason(rawCar) {
  const sellerPolicy = sellerDamagePolicy(rawCar);
  if (sellerPolicy) return sellerPolicy.reason;
  if (rawCar.isDamaged === true) return 'Apify isDamaged alanı true';
  // isDamaged metni importer/skill tarafindan BILEREK konur (dil bagimsiz sozlesme):
  // olumsuzlama icermedigi surece hasar beyanidir.
  if (typeof rawCar.isDamaged === 'string' && rawCar.isDamaged.trim() && !isNegatedDamageText(rawCar.isDamaged)) return `Apify isDamaged metninde tespit edildi: "${rawCar.isDamaged}"`;
  if (!!rawCar.isDamaged && typeof rawCar.isDamaged !== 'string') return 'Apify isDamaged alanı truthy';
  const vehicleCondition = rawCar.attributes?.['Vehicle condition'] || '';
  if (/accident/i.test(vehicleCondition) && !isNegatedDamageText(vehicleCondition)) return `Apify 'Vehicle condition' alanı: "${vehicleCondition}"`;
  const description = rawCar.description || '';
  const damageMatch = description.match(DAMAGE_WORDS);
  if (damageMatch && !isNegatedDamageText(damageMatch[0])) return `İlan açıklamasında tespit edildi: "${damageMatch[0].trim()}"`;
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
  const bodyResult = determineBodyStyle(textObj, { apifyCategory, vin: car.vin || rawCar.vin || '' });
  const bodyStyle = bodyResult.type;
  const isDiesel = (rawCar.properties?.fuelType || "").toLowerCase().includes("diesel") || /m440d/i.test(rawCar.title || "");
  // Hasar sinyali iki kaynaktan gelebilir: (1) ilanin kendi metni, (2) AYNI aracin
  // bayi sayfasindaki beyani. Bayide bilgi varken mobile.de'de yoksa bayi kazanir —
  // merge-twin.js bunu car.dealerReportedDamage'a yazar.
  const sellerPolicy = sellerDamagePolicy(rawCar, car);
  if (sellerPolicy) car.kazaliSeverity = sellerPolicy.severity;
  const damageReason = sellerPolicy?.reason || detectDamageReason(rawCar)
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
      ? { target: 'CABRIO_KAZALI', reason: damageReason, bodyStyleReason: bodyResult.reason }
      : { target: 'CABRIO', bodyStyleReason: bodyResult.reason };
  }
  if (bodyStyle === 'GRAN_COUPE') {
    return damageReason
      ? { target: 'GRAN_COUPE_KAZALI', reason: damageReason, bodyStyleReason: bodyResult.reason }
      : { target: 'GRAN_COUPE', bodyStyleReason: bodyResult.reason };
  }
  if (damageReason) return { target: 'COUPE_GAS_WITH_SUNROOF_KAZALI', reason: damageReason, bodyStyleReason: bodyResult.reason };
  if (isDiesel) return { target: 'COUPE_DIESEL_WITH_SUNROOF', bodyStyleReason: bodyResult.reason };
  if (isRWD) return { target: isSunroof ? 'COUPE_GAS_RWD_WITH_SUNROOF' : 'COUPE_GAS_RWD_WITHOUT_SUNROOF', bodyStyleReason: bodyResult.reason };
  return { target: isSunroof ? 'COUPE_GAS_WITH_SUNROOF' : 'COUPE_GAS_WITHOUT_SUNROOF', bodyStyleReason: bodyResult.reason };
}
