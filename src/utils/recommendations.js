// Öneri kategorileri + sıralama mantığı — hem Recommendations UI'ı
// hem MainTabs (computeSuggestedIds) kullanır; tek kaynak burası.
//
// Kategoriler 3 katmana (tier) ayrılır — her biri satın alma yolculuğunda FARKLI
// bir kararı cevaplar, birbirinin kopyası değildir:
//   AL     → kararı doğrudan veren (Genel / Gerçek Fırsat / Değer)
//   İNCELE → araştırma adayları (Pazarlık / Gizli Değer)
//   KEŞİF  → referans/karşılaştırma (Donanım)
import { BUDGET_MAX } from './pricingCalculator';

const formatEuro = (v) => `€${Math.round(v).toLocaleString('tr-TR')}`;
const formatDrop = (v) => `−€${Math.round(v).toLocaleString('tr-TR')}`;

export const TIERS = [
  { key: 'AL', icon: '🟢', title: 'AL — Karar ver' },
  { key: 'İNCELE', icon: '🔵', title: 'İNCELE — Derine in' },
  { key: 'KEŞİF', icon: '⚪', title: 'KEŞİF — Referans' },
];

export const CATEGORIES = [
  // --- AL ---
  {
    tier: 'AL',
    icon: '🏆',
    label: 'Genel en iyi',
    scoreLabel: 'Toplam',
    hint: 'Tüm kriterler dengeli (renk/arzu, km, fiyat, donanım) — satın alma referansı.',
    scoreOf: c => c.totalScore,
    maxScoreOf: () => 100,
  },
  {
    tier: 'AL',
    icon: '💎',
    label: 'Gerçek Fırsat',
    scoreLabel: 'Fırsat',
    hint: 'Piyasa değerine göre en ucuz fiyatlanmış — donanımı düşülmüş net maliyet (düşük=iyi).',
    scoreOf: c => c.metrics.expectedDealScore,
    lowerIsBetter: true,
    filter: c => c.metrics.baseTotalCost <= BUDGET_MAX,
    format: formatEuro,
  },
  {
    tier: 'AL',
    icon: '💰',
    label: 'En iyi değer',
    scoreLabel: 'Değer',
    hint: 'Bang-for-buck: donanım€ / toplam maliyet€ — en çok araba, en az para.',
    scoreOf: c => c.valueScore,
    maxScoreOf: () => 100,
  },
  // --- İNCELE ---
  {
    tier: 'İNCELE',
    icon: '📉',
    label: 'Pazarlık fırsatı',
    scoreLabel: 'Düşüş',
    hint: 'Satıcı fiyat kırmış → motivasyonlu; sık kıran daha da açık pazarlığa.',
    filter: c => c.metrics.priceDropTotal > 0 && c.metrics.baseTotalCost <= BUDGET_MAX,
    scoreOf: c => c.metrics.priceDropTotal,
    format: formatDrop,
  },
  {
    tier: 'İNCELE',
    icon: '🔍',
    label: 'Gizli Değer',
    scoreLabel: 'Upside',
    hint: 'Belgelenmemiş donanımı çok — bayi linkiyle doğrulanınca değeri artabilecek adaylar.',
    filter: c => c.metrics.unknownsCount > 0 && c.metrics.baseTotalCost <= BUDGET_MAX,
    scoreOf: c => c.metrics.unknownsPotentialValue,
    format: v => `+${formatEuro(v)}`,
  },
  // --- KEŞİF ---
  {
    tier: 'KEŞİF',
    icon: '👑',
    label: 'En iyi donanım',
    scoreLabel: 'Donanım',
    hint: 'En yüklü araç — donanımın € değeri (fiyat/renk sayılmaz).',
    scoreOf: c => c.metrics.expectedFeaturesValue,
    maxScoreOf: c => c.metrics.maxFeaturesValue,
    format: formatEuro,
  },
];

const PICKS_PER_CATEGORY = 25;

export const rankPicks = (evaluatedListings, category) => {
  const pool = category.filter ? evaluatedListings.filter(category.filter) : evaluatedListings;
  // lowerIsBetter kategorilerde (💎 Gerçek Fırsat) sıralama yönü tersine döner;
  // scoreOf yine GERÇEK pozitif değeri döndürür → format/gösterim dürüst kalır.
  const dir = category.lowerIsBetter ? -1 : 1;
  return [...pool]
    .sort((a, b) => dir * (category.scoreOf(b) - category.scoreOf(a)))
    .slice(0, PICKS_PER_CATEGORY);
};

export const computeSuggestedIds = (evaluatedListings) => {
  const ids = new Set();
  CATEGORIES.forEach(category => {
    rankPicks(evaluatedListings, category).forEach(c => ids.add(c.listingId));
  });
  return [...ids];
};
