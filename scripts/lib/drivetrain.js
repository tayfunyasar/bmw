// Bir ilanin tahrik tipini (xDrive AWD / RWD) belirler.
//
// Tek kaynak: hem parse-car-json.js hem rematch-drivetrain.js bu modulu kullanir —
// mantik asla baska bir yere kopyalanmaz (bkz. equipment-match.js ile ayni desen).
//
// ILKE (donanim eslestirmesiyle ayni): ACIKLAMA KONUSUYORSA O EZER; aciklama
// susuyorsa yapisal checkbox karar verir.
//
// Oncelik sirasi:
//   0. VIN tip kodu (4-7. karakter)                     -> KESIN (fabrika verisi)
//   1. metin (title+description+url) "xDrive"/"Allrad"  -> xDrive AWD (certain)
//   2. metin "Heckantrieb"/"Hinterradantrieb", ya da title'da literal "RWD" -> RWD (certain)
//   3. metin sessiz + checkbox "Four-wheel drive"        -> xDrive AWD (certain)
//   4. metin sessiz + checkbox "Rear wheel drive"        -> RWD (certain)
//   5. hicbir sinyal yok                                 -> xDrive AWD (uncertain) + not
//
// Kural 1 kural 2'den once: kendi icinde celisen ilanlarda (hem xDrive hem
// Heckantrieb yazan) xDrive kazanir.
//
// Veri dayanagi (1051 dump): "Rear wheel drive" ve "Four-wheel drive" token'lari
// birbirini disliyor (0 cakisma) -> alan yapisal ve guvenilir. 774 AWD-checkbox'li
// aracin HICBIRINDE "Heckantrieb" gecmiyor -> metindeki Heckantrieb yaniltici degil,
// karar verdirici. 107 ilanda metin sessiz ve tek kanit "Rear wheel drive" checkbox'i.

// VIN tip kodu -> tahrik esleme tablosu; veri olarak JSON'da (tek kaynak).
// DIKKAT: bu modulu UI de import ediyor (CarTable → DRIVETRAIN_FORMULA), o yuzden
// burada fs/path/url KULLANILAMAZ. Import attribute'u hem Node 22+ hem Vite'ta calisir.
import { typeCodeFromVin, vehicleIdentityFromVin } from './vehicle-identity.js';
// Dil kaliplari KODDA DEGIL: TEXT_SIGNALS.json → drivetrain.awdWords/rwdWords/rwdTitleTokens.
import { TEXT_SIGNALS, matchAnyWord } from './text-signals.js';

const { awdWords, rwdWords, rwdTitleTokens } = TEXT_SIGNALS.drivetrain;

// Geriye uyumluluk: mevcut cagiranlar yardimciyi drivetrain modulunden de alabilir.
export { typeCodeFromVin } from './vehicle-identity.js';

export const AWD = 'xDrive AWD';
export const RWD = 'RWD';

export const FEATURE_AWD = 'Four-wheel drive';
export const FEATURE_RWD = 'Rear wheel drive';

// Hicbir tahrik sinyali bulunamadiginda dusulen not (xDrive varsayilir).
export const NO_SIGNAL_NOTE =
  '⚠️ İlanda tahrik tipine dair hiçbir sinyal yok (ne metin, ne checkbox). ' +
  'xDrive varsayıldı — satıcıdan teyit alınmalı.';

// UI tooltip'inde gosterilen formul — buradaki oncelik sirasinin birebir ozeti.
export const DRIVETRAIN_FORMULA =
  'Formül (öncelik sırası): ' +
  '0) VIN tip kodu → kesin · ' +
  `1) metin "${awdWords.join('/')}" → xDrive · ` +
  `2) metin "${rwdWords.join('/')}" ya da başlıkta "${rwdTitleTokens.join('/')}" → RWD · ` +
  `3) mobile.de checkbox "${FEATURE_AWD}" → xDrive · ` +
  `4) mobile.de checkbox "${FEATURE_RWD}" → RWD · ` +
  '5) sinyal yok → xDrive varsayılır (belirsiz)';

// car: { title?, description?, url?, features?: string[] }
// Donen deger: { type, certain, reason, note? } — reason karari veren kurali
// ve yakalanan sinyali soyler; drivetrainReason olarak kaydedilir.
export function determineDrivetrain({ title = '', description = '', url = '', features = [], vin = '' } = {}) {
  const allText = `${title} ${description} ${url}`;

  // 0. VIN tip kodu — fabrika verisi, ilan metninden de checkbox'tan da guvenilir.
  //    Ilan hic "xDrive" yazmasa bile tahrik buradan kesin cozulur.
  const typeCode = typeCodeFromVin(vin);
  const vinMatch = vehicleIdentityFromVin(vin);
  if (vinMatch) {
    return {
      type: vinMatch.drivetrain,
      certain: true,
      reason: `Kural 0 — VIN tip kodu "${typeCode}" = ${vinMatch.model} (fabrika verisi, ilan metnini ezer)`,
    };
  }

  // 1. Metin xDrive/Allrad diyor -> aciklama ezer.
  const awdWord = matchAnyWord(allText, awdWords);
  if (awdWord) {
    return { type: AWD, certain: true, reason: `Kural 1 — ilan metninde "${awdWord}" geçiyor (açıklama ezer)` };
  }

  // 2. Metin RWD diyor -> aciklama ezer.
  const rwdWord = matchAnyWord(allText, rwdWords);
  if (rwdWord) {
    return { type: RWD, certain: true, reason: `Kural 2 — ilan metninde "${rwdWord}" geçiyor (açıklama ezer)` };
  }
  const rwdTitleToken = rwdTitleTokens.find(token => new RegExp(`\\b${token}\\b`).test(title));
  if (rwdTitleToken) {
    return { type: RWD, certain: true, reason: `Kural 2 — ilan başlığında "${rwdTitleToken}" geçiyor (açıklama ezer)` };
  }

  // 3-4. Metin sessiz -> yapisal checkbox karar verir.
  if (features.includes(FEATURE_AWD)) {
    return { type: AWD, certain: true, reason: `Kural 3 — metin sessiz; mobile.de "${FEATURE_AWD}" checkbox'ı işaretli` };
  }
  if (features.includes(FEATURE_RWD)) {
    return { type: RWD, certain: true, reason: `Kural 4 — metin sessiz; mobile.de "${FEATURE_RWD}" checkbox'ı işaretli` };
  }

  // 5. Hicbir sinyal yok.
  return {
    type: AWD,
    certain: false,
    note: NO_SIGNAL_NOTE,
    reason: 'Kural 5 — hiçbir sinyal yok (ne metin, ne checkbox); xDrive varsayıldı'
  };
}

// Ham Apify kaydindan tahrik tipini belirler (parse-car-json / rematch ortak yolu).
// vin ham Apify kaydinda YOK — bayi sayfasindan gelip listing'e yazilir, o yuzden
// cagiran taraf (rematch-drivetrain) ayrica gecirir.
export function determineDrivetrainFromRaw(rawCar = {}, vin = '') {
  return determineDrivetrain({
    title: rawCar.title || '',
    description: rawCar.description || '',
    url: rawCar.url || '',
    features: rawCar.features || [],
    vin
  });
}
