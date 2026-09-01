// Ham arac kaydini (Apify sekli — dealer crawl'lari da AYNI sekle normalize eder)
// standart listing semasina cevirir + mevcut kayda diff'li gunceller uygular.
//
// Tek kaynak: hem parse-car-json.js (mobile.de) hem import-dealer.js (bayi siteleri)
// bu modulu kullanir — esleme mantigi asla kopyalanmaz.
//
// Ham kayit sekli ("canonical raw record"): { title, description, features[],
// properties{milage, firstRegistration, upholstery, colour, manufacturerColour,
// co2Emission, generalInspection, numberOfOwners, fuelType}, price{amount},
// dealer{name, contry, addesses[], rating{total}}, createdTime?, modifiedTime?,
// renewedTime?, url?, vin?, dealerListingUrl? }

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { explainEquipmentFeatures } from './equipment-match.js';
import { determineDrivetrainFromRaw } from './drivetrain.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const meta = (f) => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/data/metadata/', f), 'utf8'));

const equipmentRules = meta('EQUIPMENT_RULES.json');
const COUNTRY_FLAGS = meta('COUNTRY_FLAGS.json');
// Rengi soylemeyen jenerik uretici boya etiketleri (or. "BMW Individuallackierung").
const COLOR_SOURCE = meta('COLOR_SOURCE.json');

export function resolveExteriorColor(props) {
  const manuf = (props.manufacturerColour || '').trim();
  const isGenericPaint = COLOR_SOURCE.genericManufacturerPaint.includes(manuf);
  return {
    exteriorColorName: isGenericPaint ? props.colour : (props.manufacturerColour || props.colour),
    // Ham uretici etiketi oldugu gibi korunur — kaybolmaz.
    exteriorPaintLabel: isGenericPaint ? manuf : undefined,
  };
}

// raw -> sema listing'i. mobileDeId cagirandan gelir (dealer URL'lerindeki query
// string'ler eski ic regex'i yaniltabilirdi); source audit etiketlerine islenir.
// vin opsiyonu: ham kayitta VIN yoksa mevcut listing'den tasinir — tahrik Kural 0
// boylece guncellemelerde de calisir (C692 regresyonu: VIN'li kaydi dump'taki
// sinyalsiz veri xDrive varsayimina geri cevirmemeli).
export function parseRawToListing(raw, { listingId, mobileDeId = null, source = 'mobile.de', vin = null } = {}) {
  const importedAt = new Date().toISOString();
  // mobile.de gercek yayin tarihini saglar. Bayi kaynaklari bu alani cogu zaman
  // vermedigi icin ilk sisteme giris ani yayin tarihi alt siniri olarak kaydedilir;
  // boylece bayi ilanlarinda createdTime hicbir zaman null kalmaz.
  const createdTime = raw.createdTime || (source !== 'mobile.de' ? importedAt : null);
  const features = raw.features || [];
  const description = raw.description || "";
  const props = raw.properties || {};

  // explain: her kodun karar gerekcesi de uretilir; S403A'ninki (dosya siniflandirici
  // karar — sunroof'lu/suz ayrimi) drivetrainReason gibi KAYDA islenir.
  const explained = explainEquipmentFeatures({ description, features, props }, equipmentRules);
  const equipmentFeatures = Object.fromEntries(Object.entries(explained).map(([c, v]) => [c, v.status]));
  const sunroofReason = explained.S403A ? `S403A=${explained.S403A.status} — ${explained.S403A.reason}` : null;

  const regMatch = (props.firstRegistration || "").match(/(\d+)\/(\d+)/);
  const firstRegistrationYearAndMonth = regMatch ? [parseInt(regMatch[2]), parseInt(regMatch[1])] : [null, null];

  // G22 LCI/Pre-LCI gecisi TESCILDEN kesin ayrilamaz — 2023/01-05 gecis doneminde
  // iki nesil birlikte tescil edildi. Foto teyidi overrideFeatures ile ezer.
  const [regY, regM] = firstRegistrationYearAndMonth;
  let modelGeneration = "Pre-LCI";
  let modelGenerationCertain = true;
  if (regY == null) {
    modelGenerationCertain = false;
  } else if (regY > 2023 || (regY === 2023 && regM >= 6)) {
    modelGeneration = "LCI";
  } else if (regY === 2023 && regM <= 5) {
    modelGenerationCertain = false;
  }

  const sellerName = raw.dealer?.name || "Unknown Dealer";
  const sellerRating = raw.dealer?.rating?.total ? ` ★${raw.dealer.rating.total}` : "";

  const countryCode = raw.dealer?.contry || "DE";
  const flag = COUNTRY_FLAGS[countryCode] || COUNTRY_FLAGS.fallback;

  // Ham adres satiri oldugu gibi korunur; yalnizca nbsp -> normal bosluk.
  let rawAddressLine = "Unknown";
  if (raw.dealer?.addesses && raw.dealer.addesses.length > 0) {
    rawAddressLine = raw.dealer.addesses[raw.dealer.addesses.length - 1].replace(/\u00A0/g, ' ').trim();
  }

  const serviceType = description.includes("Scheckheftgepflegt") || features.includes("Full Service History") ? "yes" : "unknown";
  const hasWarranty = features.includes("Warranty") ? "yes" : "no";
  // VIN varsa tahrik Kural 0'dan kesin cozulur (bayi sayfalari cogu zaman VIN yazar).
  const effectiveVin = raw.vin || vin || '';
  const drivetrain = determineDrivetrainFromRaw(raw, effectiveVin);
  const { exteriorColorName, exteriorPaintLabel } = resolveExteriorColor(props);

  return {
    listingId,
    listingUrl: raw.url || raw.dealerListingUrl || null,
    ...(raw.dealerListingUrl ? { dealerListingUrl: raw.dealerListingUrl } : {}),
    mobileDeId: mobileDeId,
    ...(effectiveVin ? { vin: effectiveVin } : {}),
    exteriorColorName: exteriorColorName,
    ...(exteriorPaintLabel ? { exteriorPaintLabel } : {}),
    interiorColorName: props.upholstery,
    drivetrainType: drivetrain.type,
    drivetrainCertain: drivetrain.certain,
    drivetrainReason: drivetrain.reason,
    sunroofReason,
    basePriceEuro: raw.price?.amount,
    mileageKm: parseInt(String(props.milage ?? "0").replace(/[^0-9]/g, "")),
    firstRegistrationYearAndMonth: firstRegistrationYearAndMonth,
    numberOfPreviousOwners: props.numberOfOwners || "?",
    warranty: {
      exists: hasWarranty
    },
    service: {
      type: serviceType,
      history: []
    },
    nextInspectionDate: props.generalInspection || "?",
    sellerTypeOrName: `${sellerName}${sellerRating}`,
    modelGeneration: modelGeneration,
    modelGenerationCertain: modelGenerationCertain,
    co2EmissionsGramPerKm: parseInt(props.co2Emission) || 0,
    listingLocation: `${flag} ${rawAddressLine}`,
    curatorPickBadge: null,
    curatorPersonalNotes: [],
    listingDescriptionNotes: [],
    listingAdditionalFeatures: [],
    equipmentFeatures: equipmentFeatures,
    listingDates: {
      createdTime,
      modifiedTime: raw.modifiedTime || null,
      renewedTime: raw.renewedTime || null
    },
    auditHistory: [
      ...(createdTime ? [{
        action: `İlan Yayınlandı (${source})`,
        detail: null,
        changes: null,
        auditDate: createdTime
      }] : []),
      {
        action: "İlan Eklendi",
        detail: "Sistem tarafından kayıt altına alındı",
        changes: null,
        auditDate: importedAt
      },
      ...(raw.renewedTime && raw.renewedTime !== raw.createdTime ? [{
        action: `İlan Yenilendi (${source})`,
        detail: null,
        changes: null,
        auditDate: raw.renewedTime
      }] : [])
    ].sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate)),
    cardThemeColorHex: (props.manufacturerColour || "").includes("weiß") ? "#e2e8f0" : "#94a3b8",
    aiCommentary: !drivetrain.certain ? [drivetrain.note || "⚠️ Tahrik tipi (xDrive/RWD) ilan metninden kesin tespit edilemedi. xDrive olarak varsayıldı — satıcıdan teyit alınmalı."] : null
  };
}

// "Veri yok" demenin tum bicimleri: eksik alan, bos metin, "?" ve sayisal 0.
// (Fiyat/km 0 olamaz; co2 0 olamaz — bu alanlarda 0 = "cekilemedi" demektir.)
export function isEmptyFieldValue(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '' || v.trim() === '?';
  if (typeof v === 'number') return v === 0;
  return false;
}

// Mevcut kayda diff'li guncelleme; overrideFeatures'taki alanlara ASLA dokunmaz.
export function applyUpdatesAndGetChanges(existingCar, newCar) {
  const changes = {};
  let hasChanges = false;

  const fieldsToCheck = [
      'basePriceEuro', 'mileageKm', 'sellerTypeOrName',
      'listingLocation', 'exteriorColorName', 'interiorColorName',
      'numberOfPreviousOwners', 'warranty', 'service', 'nextInspectionDate', 'co2EmissionsGramPerKm',
      'drivetrainType', 'drivetrainCertain', 'drivetrainReason', 'sunroofReason', 'aiCommentary'
  ];
  const overrides = existingCar.overrideFeatures || {};
  fieldsToCheck.forEach(key => {
      if (overrides[key]) return; // Manuel override korunuyor
      // Tahrik override'liysa turetilmis yan alanlari da dondur (celiski olmasin)
      if ((key === 'drivetrainCertain' || key === 'drivetrainReason') && overrides.drivetrainType) return;
      if (key === 'sunroofReason' && overrides.S403A) return; // manuel sunroof karari gerekcesiyle korunur
      // VERI SILINMEZ: ilan sayfasi bir alani bu sefer bos dondurduyse (Apify her
      // taramada CO2/HU/sahip sayisini vermez) DOLU olan eski deger korunur.
      // C831 vakasi: co2 165 -> 0 ezilmisti; benzinli M440i icin 0 imkansiz.
      if (isEmptyFieldValue(newCar[key]) && !isEmptyFieldValue(existingCar[key])) return;
      if (newCar[key] !== undefined && existingCar[key] !== newCar[key] && JSON.stringify(existingCar[key]) !== JSON.stringify(newCar[key])) {
          changes[key] = { old: existingCar[key], new: newCar[key] };
          existingCar[key] = newCar[key];
          hasChanges = true;
      }
  });

  // KM SICRAMA BEKCISI: tek guncellemede km >%50 degistiyse buyuk olasilikla ya
  // bastaki veri hataliydi ya da ayni ilan ID'sinde arac degisti (C566 vakasi:
  // 12.454 → 75.137 km — bayi ilani duzeltti, arac "firsat" degilmis). Veri yine
  // guncellenir (kaynak neyse o) ama karta KALICI uyari dusulur — insan teyidi ister.
  const kmCh = changes.mileageKm;
  if (kmCh && kmCh.old > 0 && kmCh.new > 0 && Math.abs(kmCh.new - kmCh.old) / kmCh.old > 0.5) {
      existingCar.listingDescriptionNotes = existingCar.listingDescriptionNotes || [];
      if (!existingCar.listingDescriptionNotes.some(n => String(n).startsWith('⚠️ KM sıçraması'))) {
          existingCar.listingDescriptionNotes.push(
              `⚠️ KM sıçraması: ${kmCh.old.toLocaleString('de-DE')} → ${kmCh.new.toLocaleString('de-DE')} km tek güncellemede — veri düzeltmesi ya da aynı ilanda araç değişimi olabilir, teyit et`
          );
      }
  }

  // equipmentFeatures — overrideFeatures'da tanimli olanlar ASLA otomatik guncellenmez
  if (newCar.equipmentFeatures && existingCar.equipmentFeatures) {
      Object.keys(newCar.equipmentFeatures).forEach(feat => {
          if (overrides[feat]) return;
          if (existingCar.equipmentFeatures[feat] !== newCar.equipmentFeatures[feat]) {
              changes[`equipmentFeatures.${feat}`] = {
                  old: existingCar.equipmentFeatures[feat],
                  new: newCar.equipmentFeatures[feat]
              };
              existingCar.equipmentFeatures[feat] = newCar.equipmentFeatures[feat];
              hasChanges = true;
          }
      });
  }

  return { hasChanges, changes };
}
