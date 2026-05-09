// Tek kaynak: bir aracın metin alanlarına bakarak Gran Coupé veya Cabrio olup
// olmadığını belirler. Hem parse-car-json.js (determineTargetFile) hem de
// arama sayfası tarama komutu bu modülü kullanır — kural tek yerde tanımlıdır.
//
// Regex'ler ilan başlıklarındaki yaygın varyantları kapsar: boşluksuz
// (GranCoupe), büyük harf (GRAN COUPE), encoding bozuk (Gran CoupÃ©), typo
// (Gan Coupé / Grand Coupé / Carbrio) ve kısaltma (Cab.). GC kısaltması \b
// sınırı ile yakalanır — başka kelimelerin ortasındaki "GC"yi tetiklemez.

const GRAN_COUPE_RE = /(gran[d]?|gan)\s*coup/i;
// GC kisaltmasi. \b sinirli klasik durumlar (örn. " GC ") + xDrGC / xDriveGC
// gibi yapisik varyantlar (mobile.de baslik kisaltmalari). Diger kelimelerin
// ortasindaki rastgele GC'yi tetiklememesi icin sadece bu iki on-eki kabul ediyoruz.
const GC_ABBR_RE = /(?:\b|x?Dr(?:ive)?)GC\b/;
const CABRIO_RE = /\b(ca[rb]+rio(let)?|convertible|cab\.)/i;
// BMW 4 Serisi chassis kodlari: G22 = Coupé, G23 = Cabrio, G26 = Gran Coupé.
// Apify "Model range" alaninda veya bazen baslikta net olarak gorunur.
const GC_CHASSIS_RE = /\bG26\b/;
const CABRIO_CHASSIS_RE = /\bG23\b/;

export function isGranCoupe({ title = '', subTitle = '', description = '', category = '', modelRange = '' } = {}) {
  const allText = `${title} ${subTitle} ${description} ${category} ${modelRange}`;
  return GRAN_COUPE_RE.test(allText)
    || GC_ABBR_RE.test(title)
    || GC_ABBR_RE.test(subTitle)
    || GC_CHASSIS_RE.test(allText);
}

export function isCabrio({ title = '', subTitle = '', description = '', category = '', modelRange = '' } = {}) {
  const allText = `${title} ${subTitle} ${description} ${category} ${modelRange}`;
  return CABRIO_RE.test(allText) || CABRIO_CHASSIS_RE.test(allText);
}

// Coupé / GC / Cabrio sınıflandırması.
//
// Oncelik: Apify `attributes['Category']` mobile.de'nin kendi kategori
// filtresinden geldigi icin GUVENILIR sinyaldir; satıcının elle girdigi
// Model range / chassis kodundan ustundur. Bir M440 ilani Apify'da
// "Sports Car/Coupe" diye gorunuyor ama Model range "G23" giriliyse,
// dogrusu Coupé'dur (G23 yanlis girilmis). Bu yuzden Apify Category
// taninabilir bir deger ise text-based regex kontrollerini bypass ederiz.
//
// Apify Category yoksa (14 dump'ta yok) text-based kurallar (chassis kodu,
// boslukli/boluksuz "Gran Coupe", "Cabrio" varyantlari) devreye girer.
const APIFY_COUPE_RE = /sports\s*car\s*\/?\s*coupe/i;
const APIFY_CABRIO_RE = /convertible|cabriolet|roadster/i;
const APIFY_GC_RE = /\bsaloon\b|\blimousine\b/i;

export function classifyBodyStyle(textObj = {}, opts = {}) {
  const { apifyCategory } = opts;
  if (apifyCategory) {
    if (APIFY_CABRIO_RE.test(apifyCategory)) return 'CABRIO';
    if (APIFY_GC_RE.test(apifyCategory)) return 'GRAN_COUPE';
    if (APIFY_COUPE_RE.test(apifyCategory)) {
      // Sports Car/Coupe altinda Cabrio cikmaz (onlar Convertible'a gider).
      // Hem Coupé hem Gran Coupé bu kategoride listelenebildigi icin sadece
      // GC sinyallerine bakariz; aksi halde Coupé.
      if (isGranCoupe(textObj)) return 'GRAN_COUPE';
      return 'COUPE';
    }
  }
  if (isCabrio(textObj)) return 'CABRIO';
  if (isGranCoupe(textObj)) return 'GRAN_COUPE';
  return 'COUPE';
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
