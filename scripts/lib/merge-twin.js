// Ayni fiziksel aracin bayi kaydini mobile.de (kok) kaydiyla BIRLESTIRIR.
// Tek kaynak: hem import-dealer.js (import aninda) hem merge-dealer-twins.js
// (retroaktif) bu fonksiyonu kullanir — birlestirme kurali kopyalanmaz.
//
// GUVENLI KURAL — veri EZILMEZ:
//   - dealerListingUrl: kokte yoksa yazilir (bayi-linki modeli)
//   - vin: kokte yoksa yazilir
//   - equipmentFeatures: yalnizca koktaki 'unknown' kodlar bayinin KESIN (yes/no)
//     degeriyle cozulur (bayi listesi eksik olabilir; dolu alana dokunulmaz)
//   - overrideFeatures'taki kodlara ASLA dokunulmaz
// Kok kaydin fiyat/km/renk gibi alanlari degistirilmez — mobile.de kanonik kalir.

import { isEmptyFieldValue } from './parse-listing.js';

const overridesOf = (car) => car.overrideFeatures || {};

export function mergeTwinIntoRoot(rootCar, { dealerListingUrl, vin, freshEquipment, source, fields, damageReason }) {
  const changes = {};
  // KESIN-vs-KESIN zit donanim celiskileri (yes↔no): veri DEGISTIRILMEZ ama
  // sessizce de yutulmaz — audit'e ve karta not olarak islenir. (Eksik-veri
  // farklari — unknown/bos taraf — celiski sayilmaz; bayi listeleri eksik olabilir.)
  const conflicts = [];
  if (dealerListingUrl) {
    if (!rootCar.dealerListingUrl) {
      rootCar.dealerListingUrl = dealerListingUrl;
      changes.dealerListingUrl = { old: null, new: dealerListingUrl };
    } else if (rootCar.dealerListingUrl !== dealerListingUrl) {
      // IKINCI bayi: birincil URL EZILMEZ, ek liste birikir. Boylece ayni arac
      // her iki sitenin taramasinda da "existing" olarak taninir (C264 vakasi).
      const urls = rootCar.dealerListingUrls || [];
      if (!urls.includes(dealerListingUrl)) {
        rootCar.dealerListingUrls = [...urls, dealerListingUrl];
        changes.dealerListingUrls = { old: urls.length ? urls : null, new: rootCar.dealerListingUrls };
      }
    }
  }
  if (!rootCar.vin && vin) {
    rootCar.vin = vin;
    changes.vin = { old: null, new: vin };
  }
  // GENEL KURAL: bayide bilgi VAR, mobile.de'de YOK ise bayi kazanir. Dolu bir
  // mobile.de degeri ASLA ezilmez (celiski varsa asagida equipmentConflicts'e duser).
  for (const [key, value] of Object.entries(fields || {})) {
    if (overridesOf(rootCar)[key]) continue;            // manuel karar dokunulmaz
    if (isEmptyFieldValue(value)) continue;             // bayi de bilmiyorsa gec
    if (!isEmptyFieldValue(rootCar[key])) continue;     // mobile.de biliyorsa dokunma
    changes[key] = { old: rootCar[key] ?? null, new: value };
    rootCar[key] = value;
  }
  // Hasar beyani da ayni kurala tabidir: bayi kendi sayfasinda "Unfallvorschaden: Ja"
  // diyor ve mobile.de ilaninda hasar beyani YOKSA, bayi beyani gecerlidir.
  // Yonlendirme karari route-listing.js'de — burada yalnizca sinyal yazilir.
  if (damageReason && !rootCar.dealerReportedDamage) {
    rootCar.dealerReportedDamage = { source, reason: damageReason };
    changes.dealerReportedDamage = { old: null, new: rootCar.dealerReportedDamage };
  }
  const overrides = overridesOf(rootCar);
  // KAYNAK-BAZLI birikim: bir kayda birden fazla bayi baglanabilir (C264: WELLER +
  // BMW_DE). Her sync yalniz KENDI kaynaginin girdilerini gunceller/siler — baska
  // kaynagin tespit ettigi celiskiyi ASLA ezmez ("son yazan kazanir" yasak).
  const before = JSON.stringify(rootCar.equipmentConflicts || null);
  const merged = structuredClone(rootCar.equipmentConflicts || {});
  for (const code of Object.keys(merged)) delete merged[code][source]; // bu kaynagin eski girdileri
  for (const [code, status] of Object.entries(freshEquipment || {})) {
    if (overrides[code]) continue;
    const rootStatus = rootCar.equipmentFeatures?.[code];
    if (rootStatus === 'unknown' && status !== 'unknown') {
      changes[`equipmentFeatures.${code}`] = { old: 'unknown', new: status };
      rootCar.equipmentFeatures[code] = status;
    } else if ((rootStatus === 'yes' && status === 'no') || (rootStatus === 'no' && status === 'yes')) {
      merged[code] = { ...merged[code], 'mobile.de': rootStatus, [source]: status };
      conflicts.push(`${code}: mobile.de=${rootStatus} / ${source}=${status}`);
    }
  }
  // Temizlik: mobile.de disinda kaynagi kalmayan kod celiski degildir.
  for (const code of Object.keys(merged)) {
    if (Object.keys(merged[code]).filter(k => k !== 'mobile.de').length === 0) delete merged[code];
  }
  if (Object.keys(merged).length) rootCar.equipmentConflicts = merged;
  else delete rootCar.equipmentConflicts;
  if (before !== JSON.stringify(rootCar.equipmentConflicts || null)) {
    changes.equipmentConflicts = { old: JSON.parse(before), new: rootCar.equipmentConflicts || null };
  }
  if (Object.keys(changes).length) {
    rootCar.auditHistory = rootCar.auditHistory || [];
    rootCar.auditHistory.push({
      action: 'Bayi Kaydıyla Birleştirildi',
      detail: `${source} ilanı aynı araç (tescil+km+fiyat+satıcı eşleşmesi) — bayi sayfası bağlandı, unknown donanımlar çözüldü`,
      changes,
      auditDate: new Date().toISOString(),
    });
  }
  return changes;
}
