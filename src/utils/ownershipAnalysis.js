// 15 aylik sahiplik / yeniden satis analizi.
// Sabit yil-fiyat hedefi YOK: aktif aday gelecege tasinir, o yas+km noktasina en
// yakin temiz aktif/satilmis ilanlar toplam maliyet (fiyat+BPM) bazinda emsal olur.

export const OWNERSHIP_DEFAULTS = {
  months: 15,
  annualKm: 15000,
  neighborCount: 9,
  saleHaircutRate: 0.03,
  featureRetentionRate: 0.25,
  mileageMarginalEuro: 0.18,
};

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const median = (values) => {
  const sorted = values.filter(finite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const isCleanCoupe = (car) =>
  !car.isKazali && ['COUPE_GAS_WITH_SUNROOF', 'COUPE_GAS_WITH_SUNROOF_SOLD'].includes(car.sourceCategory);

const hasUsableMarketData = (car) =>
  isCleanCoupe(car) && finite(car.metrics?.baseTotalCost) && car.metrics.baseTotalCost > 0
  && finite(car.metrics?.ageInMonths) && car.metrics.ageInMonths >= 0
  && finite(car.mileageKm) && car.mileageKm > 0
  // Tescilsiz kayitlarda pricingCalculator teknik olarak bir ageInMonths uretebilir;
  // ancak 15 ay sonraki arac yasi bilinemez. [null,null] / gecersiz ay analize GIRMEZ.
  && Number.isInteger(car.firstRegistrationYearAndMonth?.[0])
  && car.firstRegistrationYearAndMonth[0] >= 2000
  && Number.isInteger(car.firstRegistrationYearAndMonth?.[1])
  && car.firstRegistrationYearAndMonth[1] >= 1
  && car.firstRegistrationYearAndMonth[1] <= 12;

// 12 ay yas farki veya 15 bin km farki birer mesafe birimidir. Karekoklu Öklid
// mesafesi iki eksenin birbirini makul olcude dengelemesini saglar.
const marketDistance = (ageMonths, mileageKm, comp) => {
  const ageDelta = (comp.metrics.ageInMonths - ageMonths) / 12;
  const kmDelta = (comp.mileageKm - mileageKm) / 15000;
  return Math.sqrt(ageDelta ** 2 + kmDelta ** 2);
};

export function estimateFutureResale(car, referencePool, options = {}) {
  const cfg = { ...OWNERSHIP_DEFAULTS, ...options };
  const futureAgeMonths = car.metrics.ageInMonths + cfg.months;
  const futureMileageKm = car.mileageKm + (cfg.annualKm * cfg.months / 12);
  // Emsal kumesi senaryo degisince ziplayip "daha cok km = daha yuksek deger"
  // uretemesin: pazar noktasi standart 15K/yil kullanimda sabitlenir, secilen
  // kullanim bunun uzerine km basina marjinal deger farki olarak uygulanir.
  const comparisonMileageKm = car.mileageKm + (OWNERSHIP_DEFAULTS.annualKm * cfg.months / 12);
  const candidateFeatures = car.metrics.expectedFeaturesValue || 0;

  const neighbors = referencePool
    .filter(comp => comp.listingId !== car.listingId && hasUsableMarketData(comp))
    .map(comp => ({ comp, distance: marketDistance(futureAgeMonths, comparisonMileageKm, comp) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, cfg.neighborCount)
    .map(({ comp, distance }) => {
      // Donanimin liste fiyatindaki teorik degerinin yalnizca bir bolumu ikinci
      // elde korunur. Aday daha donanimliysa emsal yukari, zayifsa asagi duzelir.
      const featureDelta = (candidateFeatures - (comp.metrics.expectedFeaturesValue || 0)) * cfg.featureRetentionRate;
      return {
        listingId: comp.listingId,
        distance,
        weight: 1 / (0.2 + distance ** 2),
        adjustedValue: comp.metrics.baseTotalCost + featureDelta,
      };
    });

  if (neighbors.length < 3) return null;
  const weightTotal = neighbors.reduce((sum, n) => sum + n.weight, 0);
  const benchmarkResaleValue = neighbors.reduce((sum, n) => sum + n.adjustedValue * n.weight, 0) / weightTotal;
  const marketResaleValue = benchmarkResaleValue
    + ((comparisonMileageKm - futureMileageKm) * cfg.mileageMarginalEuro);
  // Spekulatif "kâr" gostermiyoruz: emsal tahmini alis maliyetini assa bile 15 aylik
  // sahiplik sonucu en fazla basabas kabul edilir.
  const conservativeResaleValue = Math.min(
    car.metrics.baseTotalCost,
    marketResaleValue * (1 - cfg.saleHaircutRate),
  );
  const meanDistance = neighbors.reduce((sum, n) => sum + n.distance, 0) / neighbors.length;
  const variance = neighbors.reduce((sum, n) => sum + n.weight * (n.adjustedValue - benchmarkResaleValue) ** 2, 0) / weightTotal;

  return {
    futureAgeMonths,
    futureMileageKm: Math.round(futureMileageKm),
    comparisonMileageKm: Math.round(comparisonMileageKm),
    marketResaleValue: Math.round(marketResaleValue),
    conservativeResaleValue: Math.round(conservativeResaleValue),
    depreciationCost: Math.round(car.metrics.baseTotalCost - conservativeResaleValue),
    depreciationPercent: Math.round(((car.metrics.baseTotalCost - conservativeResaleValue) / car.metrics.baseTotalCost) * 1000) / 10,
    neighborIds: neighbors.map(n => n.listingId),
    uncertaintyEuro: Math.round(Math.sqrt(variance)),
    confidence: meanDistance < 0.75 ? 'high' : meanDistance < 1.5 ? 'medium' : 'low',
  };
}

export function analyzeOwnership(candidates, referencePool, options = {}) {
  const cfg = { ...OWNERSHIP_DEFAULTS, ...options };
  const results = candidates
    .filter(car => !car.isSold && hasUsableMarketData(car))
    .map(car => {
      const projection = estimateFutureResale(car, referencePool, cfg);
      return projection ? { car, ...projection } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.depreciationCost - b.depreciationCost);

  // "Mantikli kriter" tum ilk 5'in kaba min/max'i degildir. En iyi sonucun en
  // fazla €5K gerisindeki guvenilir adaylar ayni optimal bant sayilir; pahali yeni
  // araclar sirf listede 4./5. diye hedef bandini bozmaz.
  const bestLoss = results[0]?.depreciationCost;
  const competitive = results.filter(x => x.confidence !== 'low' && x.depreciationCost <= bestLoss + 5000);
  const leaders = (competitive.length ? competitive : results).slice(0, 5);
  const years = leaders.map(x => x.car.firstRegistrationYearAndMonth?.[0]).filter(finite);
  const kms = leaders.map(x => x.car.mileageKm);
  const prices = leaders.map(x => x.car.basePriceEuro);
  const totals = leaders.map(x => x.car.metrics.baseTotalCost);

  return {
    options: cfg,
    results,
    criteria: leaders.length ? {
      yearMedian: Math.round(median(years)),
      yearMin: Math.min(...years),
      yearMax: Math.max(...years),
      kmMedian: Math.round(median(kms)),
      kmMin: Math.round(Math.min(...kms)),
      kmMax: Math.round(Math.max(...kms)),
      priceMedian: Math.round(median(prices)),
      totalCostMedian: Math.round(median(totals)),
      sampleSize: leaders.length,
    } : null,
    referenceCount: referencePool.filter(hasUsableMarketData).length,
  };
}
