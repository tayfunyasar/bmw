// Belgelenmemis (unknown) donanimin "beklenen degeri"ni dataset'ten turetir.
//
// Fikir: bir donanim bir ilanin metninde/checkbox'inda dogrulanamadiginda (unknown),
// gercekte var olma olasiligi dataset genelindeki base-rate'e esittir. Ornegin
// Sunroof bilinen ilanlarin %100'unde varsa, bir unknown Sunroof'a neredeyse tam
// kredi; Standheizung %0 ise sifira yakin kredi verilir. Boylece "donanimli ama
// belgelenmemis" ilan adilce degerlenir, "gercekten yok" olan cezalanmaz.
//
// Saf modul: DATA BARREL (../data) import ETMEZ — hem Vite hem de Node test
// ortaminda calisir, pricingCalculator ve testler ayni kaynagi paylasir (DRY).

// Laplace (add-alpha) yumusatmasi: kucuk/yanli orneklerde base-rate'i 0/1'e
// sabitlemez. alpha=1 → 18/0 ~%95, 1/1 %50, 0/0 (hic bilinmiyor) %50 (notr).
const DEFAULT_ALPHA = 1;

// Her rule.code icin P(var | bilinen) olasiligini dataset'ten hesaplar.
//   cars: { equipmentFeatures: { [code]: "yes"|"no"|"unknown" } }[]
//   equipmentRules: EQUIPMENT_RULES.json dizisi
//   donus: { [code]: number in [0,1] }
export function computeBaseRates(cars = [], equipmentRules = [], alpha = DEFAULT_ALPHA) {
  const baseRates = {};
  for (const rule of equipmentRules) {
    let yes = 0;
    let no = 0;
    for (const car of cars) {
      const v = car?.equipmentFeatures?.[rule.code];
      if (v === 'yes') yes++;
      else if (v === 'no') no++;
    }
    // unknown'lar paydaya girmez — yalnizca dogrulanmis (yes/no) ornek sayilir.
    baseRates[rule.code] = (yes + alpha) / (yes + no + 2 * alpha);
  }
  return baseRates;
}

// Bir aracin unknown donanimlarinin beklenen € degeri.
//   equipmentFeatures: { [code]: "yes"|"no"|"unknown" }
//   equipmentRules: EQUIPMENT_RULES.json dizisi (price, score, code)
//   baseRates: computeBaseRates ciktisi
// yes/no katki vermez (yes zaten dogrulanmis degerde, no gercekten yok).
export function unknownsExpectedValue(equipmentFeatures = {}, equipmentRules = [], baseRates = {}) {
  let total = 0;
  for (const rule of equipmentRules) {
    if (rule.score > 0 && equipmentFeatures[rule.code] === 'unknown') {
      const p = baseRates[rule.code] ?? 0;
      total += rule.price * rule.score * p;
    }
  }
  return Math.round(total);
}

// Bir aracin unknown donanimlarinin beklenen SKOR katkisi (yalnizca score, price'siz).
// expectedCriticalScore = criticalFeaturesScore + bu → belgelenmemis ama muhtemel
// donanimli araclar donanim kategorilerinde (👑/⚖️) de adilce yukselir. Fractional
// birakilir (esik/siralama icin); yuvarlama gosterimde yapilir.
export function unknownsExpectedScore(equipmentFeatures = {}, equipmentRules = [], baseRates = {}) {
  let total = 0;
  for (const rule of equipmentRules) {
    if (rule.score > 0 && equipmentFeatures[rule.code] === 'unknown') {
      total += rule.score * (baseRates[rule.code] ?? 0);
    }
  }
  return total;
}
