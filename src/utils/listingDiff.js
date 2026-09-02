// Iki listing kaydinin (bayi kaydi + muhtemel mobile.de ikizi) ORTAK OLMAYAN
// alanlarini cikarir — UI'da celiski tablosu olarak gosterilir.
// Saf fonksiyon, browser-safe. Kaynak veri degistirilmez.
import { equipmentRules } from '../data';
import { allByTotalCost } from './pricingCalculator';

// possibleTwinOf bagini cozer — ikiz tum kaynak havuzunda aranir (tek kaynak;
// MobileCarCards ve CarTable ikisi de bunu kullanir).
// listingId -> arac indeksi (bir kez kurulur). Lineer arama, tum kategoriler secili
// iken (1000+ arac × 1000+ kayit) tabloyu kilitliyordu.
const CAR_BY_ID = new Map(allByTotalCost.map(c => [c.listingId, c]));
export const findTwin = (car) => car?.possibleTwinOf ? CAR_BY_ID.get(car.possibleTwinOf) || null : null;

const EQUIP_NAME = Object.fromEntries(equipmentRules.map(r => [r.code, r.name]));
// Donanim kodu -> insan-okur ad (tek kaynak; Icons/FeatureIcon da bunu kullanir).
export const equipmentNameOf = (code) => EQUIP_NAME[code] || code;
const STATUS_TR = { yes: '✅ var', no: '❌ yok', unknown: '❓ belirsiz' };

// Karsilastirilan skalar alanlar (etiketleriyle). listingId/url/audit gibi kimlik
// alanlari bilerek DISARIDA — onlar zaten farkli olmak zorunda.
const SCALAR_FIELDS = [
  ['basePriceEuro', 'Fiyat', v => v != null ? `€${Number(v).toLocaleString('tr-TR')}` : '—'],
  ['mileageKm', 'Kilometre', v => v != null ? `${Number(v).toLocaleString('tr-TR')} km` : '—'],
  ['exteriorColorName', 'Dış renk', v => v ?? '—'],
  ['interiorColorName', 'İç renk', v => v ?? '—'],
  ['firstRegistrationYearAndMonth', 'Tescil', v => Array.isArray(v) ? v.filter(Boolean).join('/') || '—' : '—'],
  ['numberOfPreviousOwners', 'Sahip', v => v ?? '—'],
  ['co2EmissionsGramPerKm', 'CO₂', v => v ? `${v} g/km` : '—'],
  ['drivetrainType', 'Tahrik', v => v ?? '—'],
  ['modelGeneration', 'Nesil', v => v ?? '—'],
  ['vin', 'VIN', v => v ?? '—'],
  ['nextInspectionDate', 'Muayene', v => v ?? '—'],
  ['warranty', 'Garanti', v => STATUS_TR[v?.exists] ?? v?.exists ?? '—'],
  ['service', 'Servis', v => STATUS_TR[v?.type] ?? v?.type ?? '—'],
];

// a = bayi kaydi (W1), b = mobile.de ikizi (C264).
// Donus: [{ key, label, a, b }] — yalnizca FARKLI olanlar.
export function diffListings(a, b) {
  if (!a || !b) return [];
  const out = [];

  for (const [key, label, fmt] of SCALAR_FIELDS) {
    const va = fmt(a[key]);
    const vb = fmt(b[key]);
    if (va !== vb) out.push({ key, label, a: va, b: vb });
  }

  // Donanim celiskileri — en degerli kisim: bir kaynak "var" derken digeri "yok/belirsiz".
  const ea = a.equipmentFeatures || {};
  const eb = b.equipmentFeatures || {};
  for (const code of new Set([...Object.keys(ea), ...Object.keys(eb)])) {
    const sa = ea[code] ?? 'unknown';
    const sb = eb[code] ?? 'unknown';
    if (sa !== sb) {
      out.push({ key: `eq:${code}`, label: EQUIP_NAME[code] || code, a: STATUS_TR[sa] ?? sa, b: STATUS_TR[sb] ?? sb, isEquipment: true });
    }
  }
  return out;
}
