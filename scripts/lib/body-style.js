// Tek kaynak: bir aracin VIN + ilan alanlarindan govde tipini belirler.
// Oncelik govde adina degil kaynak guvenilirligine aittir:
// fabrika tip kodu > acik guncel baslik > yapisal kategori > model serisi.
//
// Regex'ler ilan başlıklarındaki yaygın varyantları kapsar: boşluksuz
// (GranCoupe), büyük harf (GRAN COUPE), encoding bozuk (Gran CoupÃ©), typo
// (Gan Coupé / Grand Coupé / Carbrio) ve kısaltma (Cab.). GC kısaltması \b
// sınırı ile yakalanır — başka kelimelerin ortasındaki "GC"yi tetiklemez.

const GRAN_COUPE_RE = /(gran[d]?|gan)\s*coup/i;
// GC kisaltmasi. \b sinirli klasik durumlar (örn. " GC ", "G.C.") + xDrGC /
// xDriveGC gibi yapisik varyantlar (mobile.de baslik kisaltmalari). G ile C
// arasindaki opsiyonel nokta (G.C.) da kapsanir. Diger kelimelerin ortasindaki
// rastgele GC'yi tetiklememesi icin sadece bu iki on-eki kabul ediyoruz.
const GC_ABBR_RE = /(?:\b|x?Dr(?:ive)?)G\.?C\b/;
// Kapi sayisi: 4 Serisi Coupé 2 kapili, Gran Coupé 5 kapilidir. Bayi
// basliklarinda/slug'larinda "5-Türer" / "5-tuerer" GC'nin net isaretidir
// (Unterberger boyle listeler). Sadece baslik/altbaslikta aranir — ilan
// aciklamasindaki serbest metin yanlis pozitif uretmesin.
const GC_DOORS_RE = /\b5[\s-]*t(?:ü|ue|u)rer\b/i;
const CABRIO_RE = /\b(ca[rb]+rio(let)?|convertible|cab\.)/i;
// `\b` é harfinden sonra sinir sayilmaz; Unicode harf lookahead'i kullan.
const COUPE_RE = /\bcoup(?:e|é)(?!\p{L})/iu;
// BMW 4 Serisi chassis kodlari: G22 = Coupé, G23 = Cabrio, G26 = Gran Coupé.
// Apify "Model range" alaninda veya bazen baslikta net olarak gorunur.
const GC_CHASSIS_RE = /\bG26\b/;
const CABRIO_CHASSIS_RE = /\bG23\b/;
const COUPE_CHASSIS_RE = /\bG22\b/;

import { vehicleIdentityFromVin } from './vehicle-identity.js';

export function isGranCoupe({ title = '', subTitle = '', description = '', category = '', modelRange = '' } = {}) {
  const allText = `${title} ${subTitle} ${description} ${category} ${modelRange}`;
  return GRAN_COUPE_RE.test(allText)
    || GC_ABBR_RE.test(title)
    || GC_ABBR_RE.test(subTitle)
    || GC_DOORS_RE.test(title)
    || GC_DOORS_RE.test(subTitle)
    || GC_CHASSIS_RE.test(allText);
}

export function isCabrio({ title = '', subTitle = '', description = '', category = '', modelRange = '' } = {}) {
  const allText = `${title} ${subTitle} ${description} ${category} ${modelRange}`;
  return CABRIO_RE.test(allText) || CABRIO_CHASSIS_RE.test(allText);
}

const APIFY_COUPE_RE = /sports\s*car\s*\/?\s*coupe/i;
const APIFY_CABRIO_RE = /convertible|cabriolet|roadster/i;
const APIFY_GC_RE = /\bsaloon\b|\blimousine\b/i;

export function bodyStyleFromHeading(title = '', subTitle = '') {
  const heading = `${title} ${subTitle}`;
  // "Gran Coupe" icindeki Coupe normal coupe olarak yakalanmadan once GC bakilir.
  if (CABRIO_RE.test(heading)) return 'CABRIO';
  if (GRAN_COUPE_RE.test(heading) || GC_ABBR_RE.test(heading) || GC_DOORS_RE.test(heading)) return 'GRAN_COUPE';
  if (COUPE_RE.test(heading)) return 'COUPE';
  return null;
}

export function determineBodyStyle(textObj = {}, opts = {}) {
  const { apifyCategory = '', vin = '' } = opts;

  // Kural 0: bilinen VIN tip kodu fabrika kimligidir ve tum ilan metnini ezer.
  const identity = vehicleIdentityFromVin(vin);
  if (identity?.bodyStyle) {
    return {
      type: identity.bodyStyle,
      certain: true,
      reason: `Kural 0 — VIN tip kodu "${identity.typeCode}" = ${identity.model} (${identity.chassis}, fabrika verisi)`,
    };
  }

  // Kural 1: guncel basliktaki acik govde adi, eski kalabilen kategori alanini ezer.
  const headingStyle = bodyStyleFromHeading(textObj.title, textObj.subTitle);
  if (headingStyle) {
    return { type: headingStyle, certain: true, reason: `Kural 1 — güncel ilan başlığında açıkça ${headingStyle} yazıyor` };
  }

  // Kural 1b: mobile.de "Model range" alani govde adini ACIKCA yaziyorsa kaba
  // "Category" alanini EZER — model serisi daha spesifiktir. Gran Coupé ilanlari
  // Category'de sik sik "Sports Car/Coupe" diye gruplanir (C1126 vakasi:
  // modelRange "4-er Gran Coupe" iken Category "Sports Car/Coupe" oldugu icin
  // arac COUPE havuzuna dusmustu). Sadece GC/Cabrio icin: bu iki ad model
  // serisinde net gecer; "Coupe" adi ise "Gran Coupe" icinde de gectigi ve
  // Category ile zaten uyumlu oldugu icin Kural 2'ye birakilir.
  const modelRangeName = textObj.modelRange || '';
  if (CABRIO_RE.test(modelRangeName)) return { type: 'CABRIO', certain: true, reason: `Kural 1b — model serisi "${modelRangeName}"` };
  if (GRAN_COUPE_RE.test(modelRangeName) || GC_ABBR_RE.test(modelRangeName)) return { type: 'GRAN_COUPE', certain: true, reason: `Kural 1b — model serisi "${modelRangeName}"` };

  // Kural 2: baslik sessizse mobile.de'nin yapisal kategorisi.
  if (APIFY_CABRIO_RE.test(apifyCategory)) return { type: 'CABRIO', certain: true, reason: `Kural 2 — mobile.de kategorisi "${apifyCategory}"` };
  if (APIFY_GC_RE.test(apifyCategory)) return { type: 'GRAN_COUPE', certain: true, reason: `Kural 2 — mobile.de kategorisi "${apifyCategory}"` };
  if (APIFY_COUPE_RE.test(apifyCategory)) return { type: 'COUPE', certain: true, reason: `Kural 2 — mobile.de kategorisi "${apifyCategory}"` };

  // Dealer canonical raw kayitlarinda kategori bazen attributes disinda gelir.
  if (APIFY_CABRIO_RE.test(textObj.category || '') || CABRIO_RE.test(textObj.category || '')) return { type: 'CABRIO', certain: true, reason: `Kural 2 — ilan kategorisi "${textObj.category}"` };
  if (APIFY_GC_RE.test(textObj.category || '') || GRAN_COUPE_RE.test(textObj.category || '')) return { type: 'GRAN_COUPE', certain: true, reason: `Kural 2 — ilan kategorisi "${textObj.category}"` };
  if (APIFY_COUPE_RE.test(textObj.category || '') || COUPE_RE.test(textObj.category || '')) return { type: 'COUPE', certain: true, reason: `Kural 2 — ilan kategorisi "${textObj.category}"` };

  // Kural 3: baslik/kategori yoksa model serisi. Aciklama bayi sablonu olabilecegi
  // icin tek basina dosya tasimaz; yalniz ekipman/uyari katmaninda kullanilir.
  const modelRange = textObj.modelRange || '';
  if (CABRIO_CHASSIS_RE.test(modelRange)) return { type: 'CABRIO', certain: true, reason: `Kural 3 — model serisi "${modelRange}"` };
  if (GC_CHASSIS_RE.test(modelRange)) return { type: 'GRAN_COUPE', certain: true, reason: `Kural 3 — model serisi "${modelRange}"` };
  if (COUPE_CHASSIS_RE.test(modelRange)) return { type: 'COUPE', certain: true, reason: `Kural 3 — model serisi "${modelRange}"` };

  return { type: 'COUPE', certain: false, reason: 'Kural 4 — gövde sinyali yok; COUPE varsayıldı' };
}

export function classifyBodyStyle(textObj = {}, opts = {}) {
  return determineBodyStyle(textObj, opts).type;
}

// parse-car-json.js icin yardimci: ham Apify nesnesinden body-style'a
// verilecek metin objesini cikarir (attributes['Model range'] dahil).
// Ayri olarak `apifyCategory` da dondurulur ki classifyBodyStyle ona
// oncelikli baksin.
export function rawCarToTextObj(rawCar = {}) {
  return {
    title: rawCar.title || '',
    subTitle: rawCar.subTitle || '',
    description: rawCar.description || '',
    category: rawCar.category || '',
    modelRange: rawCar.attributes?.['Model range'] || ''
  };
}

export function rawCarApifyCategory(rawCar = {}) {
  return rawCar.attributes?.['Category'] || '';
}
