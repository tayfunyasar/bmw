// Öneri kategorileri — metadata (RECOMMENDATIONS.json) + davranış (bu dosya).
// Saf veri (tier/icon/label/hint/lowerIsBetter) JSON'da; scoreOf/filter/format MANTIK
// olduğu için kodda kalır. İkisi id üzerinden birleştirilir (config-driven).
import { BUDGET_MAX } from './pricingCalculator';
import { RECOMMENDATIONS } from '../data';

const formatEuro = (v) => `€${Math.round(v).toLocaleString('tr-TR')}`;
const formatDrop = (v) => `−€${Math.round(v).toLocaleString('tr-TR')}`;

export const TIERS = RECOMMENDATIONS.tiers;

// id → davranış (fonksiyon alanları JSON'a taşınamaz, burada kalır)
const BEHAVIOR = {
  genel:    { scoreOf: c => c.totalScore, maxScoreOf: () => 100 },
  firsat:   { scoreOf: c => c.metrics.expectedDealScore, filter: c => c.metrics.baseTotalCost <= BUDGET_MAX, format: formatEuro },
  deger:    { scoreOf: c => c.valueScore, maxScoreOf: () => 100 },
  pazarlik: { scoreOf: c => c.metrics.priceDropTotal, filter: c => c.metrics.priceDropTotal > 0 && c.metrics.baseTotalCost <= BUDGET_MAX, format: formatDrop },
  // Fiyatı düşenler: sıralama SON fiyat değişikliği tarihine göre (en yeni indirim başta). Gösterim özel (priceDropView).
  fiyatDusen: { scoreOf: c => (c.metrics.lastDropDate ? new Date(c.metrics.lastDropDate).getTime() : 0), filter: c => c.metrics.priceDropTotal > 0, priceDropView: true },
  gizli:    { scoreOf: c => c.metrics.unknownsPotentialValue, filter: c => c.metrics.unknownsCount > 0 && c.metrics.baseTotalCost <= BUDGET_MAX, format: v => `+${formatEuro(v)}` },
  donanim:  { scoreOf: c => c.metrics.expectedFeaturesValue, maxScoreOf: c => c.metrics.maxFeaturesValue, format: formatEuro },
};

// Metadata (JSON) + davranış (kod) birleşimi — sıralamanın kullandığı tam kategori.
export const CATEGORIES = RECOMMENDATIONS.categories.map(meta => ({ ...meta, ...BEHAVIOR[meta.id] }));

export const rankPicks = (evaluatedListings, category) => {
  const pool = category.filter ? evaluatedListings.filter(category.filter) : evaluatedListings;
  // lowerIsBetter (💎 Gerçek Fırsat) → sıralama tersine; scoreOf yine gerçek pozitif değeri döndürür.
  const dir = category.lowerIsBetter ? -1 : 1;
  // Limit yok — her kategori, (filtrelenmiş) havuzdaki tüm uygun araçları sıralı gösterir.
  return [...pool].sort((a, b) => dir * (category.scoreOf(b) - category.scoreOf(a)));
};

export const computeSuggestedIds = (evaluatedListings) => {
  const ids = new Set();
  CATEGORIES.forEach(category => {
    rankPicks(evaluatedListings, category).forEach(c => ids.add(c.listingId));
  });
  return [...ids];
};
