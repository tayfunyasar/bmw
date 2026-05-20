// Bir aracin metin/feature/props verisini EQUIPMENT_RULES kurallariyla esler
// ve her kural kodu icin "yes" / "no" / "unknown" durumu uretir.
//
// Tek kaynak: hem parse-car-json.js hem de equipment-rules.test.js bu modulu
// kullanir — eslestirme mantigi asla baska bir yere kopyalanmaz.
//
// Eslestirme oncelik sirasi (yuksekten dusuge):
//   1. description pozitif eslesme  -> "yes"  (bayinin kendi metni; en yetkili)
//   2. negativeDescription eslesme  -> "no"
//   3. features / props eslesme     -> "yes"
//   4. hicbiri                      -> "unknown"
// Ardindan impliedBy: ust ozellik description'da geciyorsa alt ozellik "yes".
//
// Tum metin karsilastirmalari kucuk harfe cevrilir ve tire/uzun-tire (- –)
// bosluga normalize edilir; boylece "Driving-Assistant" ~ "Driving Assistant".

const DASH_RE = /[-–]/g;

// Kucuk harf + tire/uzun-tireyi bosluga cevirerek metni normalize eder.
export function normalizeText(text = '') {
  return String(text).toLowerCase().replace(DASH_RE, ' ');
}

// Tek bir aracin donanim durumlarini hesaplar.
//   car: { description?: string, features?: string[], props?: object }
//   equipmentRules: EQUIPMENT_RULES.json dizisi
//   donus: { [rule.code]: "yes" | "no" | "unknown" }
export function matchEquipmentFeatures(car = {}, equipmentRules = []) {
  const description = car.description || '';
  const features = car.features || [];
  const props = car.props || {};

  const descNormalized = normalizeText(description);
  const descMatches = (keyword) => descNormalized.includes(normalizeText(keyword));

  const equipmentFeatures = {};

  for (const rule of equipmentRules) {
    // 1. Pozitif description eslesmesi (en yuksek oncelik — bayinin kendi metni).
    let matchDescription = false;
    if (rule.matchType === 'ALL_DESCRIPTION' && rule.description?.length > 0) {
      matchDescription = rule.description.every(descMatches);
    } else if (rule.description?.length > 0) {
      matchDescription = rule.description.some(descMatches);
    }
    if (matchDescription) {
      equipmentFeatures[rule.code] = 'yes';
      continue;
    }

    // 2. Negatif description (yalnizca pozitif eslesme yokken anlamli).
    if (rule.negativeDescription?.length > 0 && rule.negativeDescription.some(descMatches)) {
      equipmentFeatures[rule.code] = 'no';
      continue;
    }

    // 3. features dizisi ve props (Apify anahtar-deger verisi — dusuk oncelik).
    const matchFeatures = rule.features?.some(f => features.includes(f));
    const matchProps = rule.props
      ? Object.entries(rule.props).some(([propKey, propValues]) =>
          propValues.some(val => (props[propKey] || '').includes(val)))
      : false;

    equipmentFeatures[rule.code] = matchFeatures || matchProps ? 'yes' : 'unknown';
  }

  // impliedBy: ust ozellik description'da geciyorsa alt ozellik "yes" olur.
  for (const rule of equipmentRules) {
    if (rule.impliedBy && equipmentFeatures[rule.code] !== 'yes') {
      if (rule.impliedBy.some(p => descNormalized.includes(normalizeText(p)))) {
        equipmentFeatures[rule.code] = 'yes';
      }
    }
  }

  return equipmentFeatures;
}
