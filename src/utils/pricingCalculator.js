import { CoupeGasWithSunroof, soldGasListings, equipmentRules, PRICING_CONSTANTS, isColorFav, isColorNotFav, isInteriorFav, isInteriorNotFav } from '../data';
import { computeBaseRates, unknownsExpectedValue, unknownsExpectedScore } from './expectedValue.js';

const { EVALUATION_DATE, TIME_CONSTANTS, DEPRECIATION_RATES, BPM_DEFAULT_CO2, FEATURE_STATUS, OWNER_ADJUSTMENT_EUR } = PRICING_CONSTANTS;

// Model-geneli donanim base-rate'leri (bir kez, aktif referans populasyon uzerinden).
// calculateCarMetrics her arac icin beklenen (base-rate agirlikli) belirsiz deger/skor
// kredisini bununla hesaplar → tum sekmelerde (ana + diesel/rwd/kazali) tutarli.
const equipmentBaseRates = computeBaseRates(CoupeGasWithSunroof, equipmentRules);

// Tum kritik donanimin maksimum € degeri (Σ price×score, score>0). Donanim skoru
// artik "kac ozellik" (breadth) degil € DEGERE gore hesaplaniyor → premium yuklu
// (Laser/DAPRO/HK gibi pahali donanimli) araclar hak ettikleri agirligi alir.
const MAX_FEATURES_VALUE = equipmentRules.reduce((s, r) => s + (r.score > 0 ? r.price * r.score : 0), 0);

// --- Time Calculations ---
const calculateAgeInMonths = (registrationYear, registrationMonth) => {
  const evaluation = new Date(EVALUATION_DATE.year, EVALUATION_DATE.month, EVALUATION_DATE.day);
  const registration = new Date(registrationYear, registrationMonth - 1, 1);
  
  const ageInDays = (evaluation.getTime() - registration.getTime()) / TIME_CONSTANTS.millisecondsInADay;
  return Math.round(ageInDays / TIME_CONSTANTS.daysInAverageMonth);
};

// --- Depreciation Calculations ---
const calculateMileagePenalty = (mileage) => {
  let penalty = 0;
  for (const bracket of DEPRECIATION_RATES.mileageBrackets) {
    if (mileage <= bracket.min) break;
    const kmInBracket = Math.min(mileage, bracket.max) - bracket.min;
    penalty += kmInBracket * bracket.rate;
  }
  // 70K+ km: en yüksek dilim oranıyla devam
  if (mileage > 70000) {
    penalty += (mileage - 70000) * DEPRECIATION_RATES.overflowRate;
  }
  return Math.round(penalty);
};

const calculateDepreciation = (ageInMonths, mileage) => {
  const agePenalty = ageInMonths * DEPRECIATION_RATES.monthlyInEuros;
  const mileagePenalty = calculateMileagePenalty(mileage);

  return {
    agePenalty,
    mileagePenalty,
    totalDepreciation: agePenalty + mileagePenalty
  };
};

// --- Feature Calculations ---
const evaluateCarFeatures = (carFeatures) => {
  return equipmentRules.map(feature => ({
    name: feature.name,
    price: feature.price,
    score: feature.score,
    tag: feature.tag,
    value: carFeatures?.[feature.code] ?? null
  }));
};
const calculateFeaturesValue = (evaluatedFeatures) => {
  // yes = tam değer, no = 0, unknown = 0 (ne ödül ne ceza)
  // Sadece doğrulanmış donanımlar düzeltilmiş maliyeti düşürür
  return evaluatedFeatures
    .filter(f => f.value === "yes")
    .reduce((sum, f) => sum + (f.price * f.score), 0);
};

// "unknown" feature'lar şu an personalDealScore'a hiç katkı vermiyor — bu fırsatları
// kaçırtabiliyor (donanımlı ama dökümante etmemiş ilanlar pahalı görünür).
// Burada *sadece bilgi amaçlı* potansiyel değeri hesaplıyoruz; skor değişmiyor.
// UI bu değeri "±€X belirsiz donanım" olarak gösterip kullanıcıyı bayi linkine yönlendirir.
const calculateUnknownsInfo = (evaluatedFeatures) => {
  const unknowns = evaluatedFeatures.filter(f => f.value === FEATURE_STATUS.unknown && f.score > 0);
  return {
    unknownsCount: unknowns.length,
    unknownsPotentialValue: unknowns.reduce((sum, f) => sum + (f.price * f.score), 0),
  };
};

// Satıcının fiyat kırma geçmişi: auditHistory'deki basePriceEuro düşüşlerini toplar.
// Çok/sık düşüren satıcı = motivasyonlu → pazarlık şansı yüksek (📉 kategorisi).
const calculatePriceDrop = (auditHistory = []) => {
  let priceDropTotal = 0;
  let priceDropCount = 0;
  for (const entry of auditHistory) {
    const change = entry.changes?.basePriceEuro;
    if (change && typeof change.old === 'number' && typeof change.new === 'number' && change.new < change.old) {
      priceDropTotal += change.old - change.new;
      priceDropCount++;
    }
  }
  return { priceDropTotal, priceDropCount };
};

const calculateOwnerAdjustment = (numberOfPreviousOwners) => {
  if (numberOfPreviousOwners == null || numberOfPreviousOwners === '?') return 0;
  const key = String(numberOfPreviousOwners);
  if (key in OWNER_ADJUSTMENT_EUR) return OWNER_ADJUSTMENT_EUR[key];
  // 4+ sahip için en yüksek ceza ile devam (defansif: data "5", "6" görse)
  const numeric = parseInt(key, 10);
  if (!Number.isFinite(numeric)) return 0;
  return OWNER_ADJUSTMENT_EUR['4'] ?? 0;
};

const calculateCriticalFeaturesScore = (evaluatedFeatures) => {
  return evaluatedFeatures.reduce((scores, feature) => {
    if (feature.score > 0) {
      scores.maximumPossibleScore += feature.score;
      
      if (feature.value === FEATURE_STATUS.yes) {
        scores.currentScore += feature.score;
      }
    }
    return scores;
  }, { currentScore: 0, maximumPossibleScore: 0 });
};

// --- BPM Calculator (historisch tarief + afschrijvingstabel) ---
// Belastingdienst: "U mag het laagste bpm-tarief gebruiken tussen de datum van
// ingebruikname en de datum van de goedkeuring door de RDW."
// Bron: external/bpm_tarieven_bpm0651z16fd.pdf (Belastingdienst tarievenlijst)
const BPM_TARIEVEN = {
  2021: [
    { min: 0, max: 79, base: 360, rate: 2 },
    { min: 79, max: 106, base: 518, rate: 60 },
    { min: 106, max: 155, base: 2138, rate: 131 },
    { min: 155, max: 173, base: 8557, rate: 213 },
    { min: 173, max: Infinity, base: 12391, rate: 424 },
  ],
  2022: [
    { min: 0, max: 81, base: 380, rate: 2 },
    { min: 81, max: 105, base: 528, rate: 64 },
    { min: 105, max: 147, base: 2064, rate: 139 },
    { min: 147, max: 164, base: 7902, rate: 228 },
    { min: 164, max: Infinity, base: 11778, rate: 457 },
  ],
  2023: [
    { min: 0, max: 82, base: 400, rate: 2 },
    { min: 82, max: 106, base: 564, rate: 68 },
    { min: 106, max: 148, base: 2196, rate: 149 },
    { min: 148, max: 165, base: 8454, rate: 244 },
    { min: 165, max: Infinity, base: 12602, rate: 488 },
  ],
  2024: [
    { min: 0, max: 80, base: 440, rate: 2 },
    { min: 80, max: 104, base: 600, rate: 76 },
    { min: 104, max: 145, base: 2424, rate: 167 },
    { min: 145, max: 161, base: 9271, rate: 274 },
    { min: 161, max: Infinity, base: 13655, rate: 549 },
  ],
  2025: [
    { min: 0, max: 79, base: 667, rate: 2 },
    { min: 79, max: 101, base: 825, rate: 79 },
    { min: 101, max: 141, base: 2563, rate: 173 },
    { min: 141, max: 157, base: 9483, rate: 284 },
    { min: 157, max: Infinity, base: 14027, rate: 568 },
  ],
  2026: [
    { min: 0, max: 77, base: 687, rate: 2 },
    { min: 77, max: 100, base: 841, rate: 82 },
    { min: 100, max: 139, base: 2727, rate: 181 },
    { min: 139, max: 155, base: 9786, rate: 297 },
    { min: 155, max: Infinity, base: 14538, rate: 594 },
  ],
};

const BPM_DEPRECIATION_TABLE = [
  { minMonth: 0, maxMonth: 1, basePercent: 0, monthlyAdd: 12 },
  { minMonth: 1, maxMonth: 3, basePercent: 12, monthlyAdd: 4 },
  { minMonth: 3, maxMonth: 5, basePercent: 20, monthlyAdd: 3.5 },
  { minMonth: 5, maxMonth: 9, basePercent: 27, monthlyAdd: 1.5 },
  { minMonth: 9, maxMonth: 18, basePercent: 33, monthlyAdd: 1 },
  { minMonth: 18, maxMonth: 30, basePercent: 42, monthlyAdd: 0.75 },
  { minMonth: 30, maxMonth: 42, basePercent: 51, monthlyAdd: 0.5 },
  { minMonth: 42, maxMonth: 54, basePercent: 57, monthlyAdd: 0.42 },
  { minMonth: 54, maxMonth: 66, basePercent: 62, monthlyAdd: 0.42 },
  { minMonth: 66, maxMonth: 78, basePercent: 67, monthlyAdd: 0.42 },
  { minMonth: 78, maxMonth: 90, basePercent: 72, monthlyAdd: 0.25 },
  { minMonth: 90, maxMonth: 102, basePercent: 75, monthlyAdd: 0.25 },
  { minMonth: 102, maxMonth: 114, basePercent: 78, monthlyAdd: 0.25 },
  { minMonth: 114, maxMonth: Infinity, basePercent: 81, monthlyAdd: 0.19 },
];

const calcBrutoBpmForYear = (co2, year) => {
  const brackets = BPM_TARIEVEN[year];
  if (!brackets) return Infinity;
  const bracket = brackets.find(b => co2 > b.min && co2 <= b.max) || brackets[brackets.length - 1];
  return bracket.base + ((co2 - bracket.min) * bracket.rate);
};

const calculateBpm = (co2, registrationYear, registrationMonth) => {
  const effectiveCo2 = (co2 && co2 > 0) ? co2 : BPM_DEFAULT_CO2;

  // Historisch tarief: laagste brüt BPM tussen ingebruikname en RDW goedkeuring
  const rdwYear = EVALUATION_DATE.year;
  const startYear = Math.max(registrationYear || rdwYear, 2021);
  let lowestBruto = Infinity;
  let tariefYear = rdwYear;
  for (let y = startYear; y <= rdwYear; y++) {
    const bruto = calcBrutoBpmForYear(effectiveCo2, y);
    if (bruto < lowestBruto) {
      lowestBruto = bruto;
      tariefYear = y;
    }
  }
  const bpmBruto = lowestBruto;

  if (!registrationYear || registrationMonth == null) return { bpmBruto, bpmCalculated: null, depreciationPercent: null, tariefYear };

  const today = new Date(EVALUATION_DATE.year, EVALUATION_DATE.month, EVALUATION_DATE.day);
  const regDate = new Date(registrationYear, registrationMonth - 1);
  const ageMonths = Math.round((today - regDate) / (TIME_CONSTANTS.millisecondsInADay * TIME_CONSTANTS.daysInAverageMonth));

  const row = BPM_DEPRECIATION_TABLE.find(d => ageMonths >= d.minMonth && ageMonths < d.maxMonth) || BPM_DEPRECIATION_TABLE[BPM_DEPRECIATION_TABLE.length - 1];
  const depPercent = Math.min(row.basePercent + ((ageMonths - row.minMonth) * row.monthlyAdd), 100);
  const bpmCalculated = Math.round(bpmBruto * (100 - depPercent) / 100);

  return { bpmBruto, bpmCalculated, depreciationPercent: Math.round(depPercent * 10) / 10, tariefYear };
};

// --- Main Calculator ---
export function calculateCarMetrics(car) {
  const [registrationYear, registrationMonth] = car.firstRegistrationYearAndMonth;
  
  // 1. Age & Depreciation
  const ageInMonths = calculateAgeInMonths(registrationYear, registrationMonth);
  const depreciation = calculateDepreciation(ageInMonths, car.mileageKm);
  
  // 2. BPM Calculation
  const bpm = calculateBpm(car.co2EmissionsGramPerKm, registrationYear, registrationMonth);

  // 3. Base Cost (fiyat + hesaplanan BPM)
  const baseTotalCost = car.basePriceEuro + (bpm.bpmCalculated || 0);

  // 4. Features & Scores
  const evaluatedFeatures = evaluateCarFeatures(car.equipmentFeatures);
  const extraFeaturesValue = calculateFeaturesValue(evaluatedFeatures);
  const featureScores = calculateCriticalFeaturesScore(evaluatedFeatures);
  const unknownsInfo = calculateUnknownsInfo(evaluatedFeatures);

  // 5. Owner adjustment (1 sahip = bonus, 3+ sahip = ceza)
  const ownerAdjustment = calculateOwnerAdjustment(car.numberOfPreviousOwners);

  // 6. Final Personal Deal Score (€ — düşük = iyi fırsat, yalnizca dogrulanmis donanim)
  const personalDealScore = baseTotalCost + depreciation.totalDepreciation - extraFeaturesValue + ownerAdjustment;

  // 7. Beklenen (base-rate agirlikli) belirsiz donanim kredisi — belgelenmemis ama
  //    muhtemel donanimli araclar hem deger hem donanim skorunda gozden kacmasin diye.
  const expectedUnknownValue = unknownsExpectedValue(car.equipmentFeatures, equipmentRules, equipmentBaseRates);
  const expectedDealScore = personalDealScore - expectedUnknownValue;
  const expectedCriticalScore = featureScores.currentScore
    + unknownsExpectedScore(car.equipmentFeatures, equipmentRules, equipmentBaseRates);

  return Object.assign({ ageInMonths }, depreciation, {
    baseTotalCost,
    evaluatedFeatures,
    extraFeaturesValue,
    criticalFeaturesScore: featureScores.currentScore,
    maxCriticalScore: featureScores.maximumPossibleScore,
    ownerAdjustment,
    unknownsCount: unknownsInfo.unknownsCount,
    unknownsPotentialValue: unknownsInfo.unknownsPotentialValue,
    personalDealScore,
    expectedDealScore,
    upsideGap: expectedUnknownValue,
    expectedCriticalScore,
    expectedFeaturesValue: extraFeaturesValue + expectedUnknownValue, // € (doğrulanmış + beklenen belirsiz)
    maxFeaturesValue: MAX_FEATURES_VALUE,                             // € (👑 kategorisinin maksimumu)
    ...calculatePriceDrop(car.auditHistory),                          // priceDropTotal, priceDropCount (📉)
    bpmCalculation: bpm
  });
}

// --- totalScore: kullanıcı kriterlerine göre 0-100 kompozit ---
// Çekirdek 4 boyut (ağırlık toplam 100) + ek bonus/ceza → sonuç 0-100'e clamp.
// Ağırlıklar/sabitler modelin tek ayar noktası.
const SCORE_WEIGHTS = {
  price: 25,         // Fiyat (exact, baseTotalCost) — düşük ağırlık; bütçe aşımı ayrı ceza
  equipment: 25,     // Donanım € değeri (doğrulanmış + beklenen belirsiz)
  kmAge: 15,         // Düşük km/yaş (yıpranma percentile)
  desirability: 35,  // Arzu: LCI + dış renk + iç renk (ağırlık artırıldı)
};
const SCORE_LABELS = {
  price: 'Fiyat (bütçe)',
  equipment: 'Donanım',
  kmAge: 'km/yaş',
  desirability: 'Arzu (LCI/renk)',
};
// Ek puanlar: bonus = VAR → +, yok → nötr (ceza değil); ceza = kötü → −.
const SERVICE_BONUS = 5;        // tam servis geçmişi (belgesiz/unknown ceza YEMEZ)
const WARRANTY_BONUS = 4;       // aktif garanti
const PRIVATE_PENALTY = 5;      // özel satıcı
const AFTERMARKET_PENALTY = 7;  // aftermarket modifikasyon
const OVER_BUDGET_PENALTY = 25; // bütçe aşımı (baseTotalCost > PRICE_MAX) → sert eleme

// Exact fiyat skoru: ucuz = yüksek, DOĞRUSAL ve sürekli (band değil → her fiyat farklı puan).
// ≤FLOOR tam puan, FLOOR→MAX doğrusal azalır, >MAX = 0 (ağır ceza, bütçe dışı).
const PRICE_FLOOR = 42000;
const PRICE_MAX = 66000;
const priceScore = (cost) => Math.max(0, Math.min(1, (PRICE_MAX - cost) / (PRICE_MAX - PRICE_FLOOR)));

// Bir metrigin dataset icindeki yuzdelik sirasi (0-1). invert=true → dusuk deger yuksek skor.
const percentileScorer = (values, invert = false) => {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return (v) => {
    if (n <= 1) return 0.5;
    const pct = sorted.filter(x => x < v).length / (n - 1);
    return invert ? 1 - pct : pct;
  };
};

const round1 = (n) => Math.round(n * 10) / 10;
const eur = (n) => '€' + Math.round(n).toLocaleString('tr-TR');

const assignRecommendations = (evaluated, referencePool = evaluated) => {
  // km/yaş referansı = referencePool (aktif pazar): düşük yıpranma (yeni/az km) = iyi.
  const kmAgeScorer = percentileScorer(referencePool.map(c => c.metrics.totalDepreciation), true);

  evaluated.forEach(car => {
    const m = car.metrics;
    const W = SCORE_WEIGHTS;
    // Çekirdek boyutların normalize (0-1) değerleri
    const priceN = priceScore(m.baseTotalCost);
    const equipN = MAX_FEATURES_VALUE > 0 ? Math.min(m.expectedFeaturesValue / MAX_FEATURES_VALUE, 1) : 0;
    const kmAgeN = kmAgeScorer(m.totalDepreciation);
    const lci = car.modelGeneration === 'LCI' ? 0.4 : 0;
    const extC = isColorFav(car.exteriorColorName) ? 0.3 : isColorNotFav(car.exteriorColorName) ? 0 : 0.15;
    const intC = isInteriorFav(car.interiorColorName) ? 0.3 : isInteriorNotFav(car.interiorColorName) ? 0 : 0.15;
    const desirN = Math.min(lci + extC + intC, 1);

    // Ek puanlar (bonus/ceza) — hem tooltip breakdown'a hem tüm kategori skorlarına.
    const extras = [];
    if (car.service?.type === 'yes') extras.push({ label: 'Tam servis', delta: SERVICE_BONUS, formula: 'belgeli servis bonusu' });
    if (car.warranty?.exists === 'yes' || car.warranty?.exists === true) extras.push({ label: 'Garanti', delta: WARRANTY_BONUS, formula: 'aktif garanti bonusu' });
    const seller = car.sellerTypeOrName?.toLowerCase() || '';
    if (seller.includes('private') || seller.includes('özel') || seller.includes('privat')) extras.push({ label: 'Özel satıcı', delta: -PRIVATE_PENALTY, formula: 'risk cezası' });
    if (car.listingAdditionalFeatures?.some(f => f.toLowerCase().includes('aftermarket'))) extras.push({ label: 'Aftermarket', delta: -AFTERMARKET_PENALTY, formula: 'risk cezası' });
    if (m.baseTotalCost > PRICE_MAX) extras.push({ label: 'Bütçe aşımı', delta: -OVER_BUDGET_PENALTY, formula: `${eur(m.baseTotalCost)} > €66K` });
    const adj = extras.reduce((s, x) => s + x.delta, 0);
    const penaltyOnly = extras.filter(x => x.delta < 0).reduce((s, x) => s + x.delta, 0); // ≤0
    const clamp100 = (v) => Math.max(0, Math.min(100, round1(v)));

    // 🏆 Genel (holistik, senin ağırlıkların — renk baskın). Tooltip breakdown bununla.
    car.totalScore = clamp100(priceN * W.price + equipN * W.equipment + kmAgeN * W.kmAge + desirN * W.desirability + adj);
    // 💰 Değer: GERÇEK ORAN — donanım€ / toplam maliyet€ (bang-for-buck). Bütçe aşımı adj ile cezalanır.
    car.valueScore = clamp100((m.expectedFeaturesValue / m.baseTotalCost) * 100 + adj);
    // ⚖️ Dengeli: 4 boyutun GEOMETRİK ORTALAMASI — bir yönü sıfırsa sıfır (bütçe aşımı → priceN 0),
    //    ama min'den daha yüksek/normalize skala (diğer kategorilerle kıyaslanabilir).
    car.balanceScore = clamp100(Math.pow(priceN * equipN * kmAgeN * desirN, 0.25) * 100 + penaltyOnly);

    car.curatorPickBadge = '';
    car.scoreBreakdown = [
      { label: SCORE_LABELS.price, delta: round1(priceN * W.price), formula: `${eur(m.baseTotalCost)} → (66K−fiyat)/24K = ${priceN.toFixed(2)} × ${W.price}` },
      { label: SCORE_LABELS.equipment, delta: round1(equipN * W.equipment), formula: `${eur(m.expectedFeaturesValue)} / ${eur(MAX_FEATURES_VALUE)} → ${equipN.toFixed(2)} × ${W.equipment}` },
      { label: SCORE_LABELS.kmAge, delta: round1(kmAgeN * W.kmAge), formula: `yıpranma ${eur(m.totalDepreciation)} → yüzdelik ${kmAgeN.toFixed(2)} × ${W.kmAge}` },
      { label: SCORE_LABELS.desirability, delta: round1(desirN * W.desirability), formula: `LCI ${lci} + dış ${extC} + iç ${intC} → ${desirN.toFixed(2)} × ${W.desirability}` },
      ...extras,
    ];
  });

  // Tek-kazanan rozetler yalnızca ALINABILIR araçlar arasından (satılmış araç 👑🏆💰⚖️ almaz).
  // Her rozet, kendi kategorisinin skoruyla seçilir (kategoriler artık farklı sıralıyor).
  const buyable = evaluated.filter(c => !c.isSold);
  const bestSpec = [...buyable].sort((a,b) => b.metrics.expectedFeaturesValue - a.metrics.expectedFeaturesValue)[0]; // 👑 donanım (€)
  const topPick = [...buyable].sort((a,b) => b.totalScore - a.totalScore)[0];        // 🏆 genel
  const budgetPick = [...buyable].sort((a,b) => b.valueScore - a.valueScore)[0];     // 💰 değer (oran)
  const balancedPick = [...buyable].sort((a,b) => b.balanceScore - a.balanceScore)[0]; // ⚖️ dengeli (geo. ort.)
  const dropPick = [...buyable]                                                        // 📉 fiyat düşüşü
    .filter(c => c.metrics.priceDropTotal > 0 && c.metrics.baseTotalCost <= PRICE_MAX)
    .sort((a,b) => b.metrics.priceDropTotal - a.metrics.priceDropTotal)[0];

  if (bestSpec) bestSpec.curatorPickBadge += '👑';
  if (topPick && !topPick.curatorPickBadge.includes('🏆')) topPick.curatorPickBadge += '🏆';
  if (budgetPick && !budgetPick.curatorPickBadge.includes('💰')) budgetPick.curatorPickBadge += '💰';
  if (balancedPick && !balancedPick.curatorPickBadge.includes('⚖️')) balancedPick.curatorPickBadge += '⚖️';
  if (dropPick && !dropPick.curatorPickBadge.includes('📉')) dropPick.curatorPickBadge += '📉';

  // If a car has no badges, reset to null
  evaluated.forEach(car => {
    if (car.curatorPickBadge === '') car.curatorPickBadge = null;
  });

  return evaluated;
};

// Tüm sekmelerde ortak kullanılan: toplam alım maliyetine göre artan sıralama
// (fiyat + BPM). Metrics yoksa hesaplanır; varsa korunur.
export const sortByTotalCost = (listings) => [...listings]
  .map(car => car.metrics ? car : Object.assign({}, car, { metrics: calculateCarMetrics(car) }))
  .sort((a, b) => a.metrics.baseTotalCost - b.metrics.baseTotalCost);

// --- Data Aggregation ---
// Metrikleri iliştir (skorlama öncesi); baseTotalCost'a göre artan sıralar.
const attachMetrics = (listings) => listings
  .map((car, index) => Object.assign({}, car, { metrics: calculateCarMetrics(car), originalIndex: index }))
  .sort((a, b) => a.metrics.baseTotalCost - b.metrics.baseTotalCost);

const groupListingsByYear = (listings) => {
  return listings.reduce((groups, car) => {
    const year = car.firstRegistrationYearAndMonth[0];
    groups[year] = groups[year] || [];
    groups[year].push(car);
    return groups;
  }, {});
};

const extractSortedYears = (groupedListings) => {
  return Object.keys(groupedListings).sort((yearA, yearB) => Number(yearB) - Number(yearA));
};

const activeCars = attachMetrics(CoupeGasWithSunroof);
const soldCars = attachMetrics(soldGasListings).map(car => Object.assign(car, { isSold: true }));

// Öneri skorları TEK referans dağılıma (aktif pazar) göre hesaplanır → sold araçlar
// aktiflerle kıyaslanabilir. Rozetler yalnız alınabilir araçlarda (fonksiyon içinde).
assignRecommendations([...activeCars, ...soldCars], activeCars);

export const evaluatedListings = activeCars;
const evaluatedSold = soldCars;
export const yearGroups = groupListingsByYear(evaluatedListings);
export const sortedYears = extractSortedYears(yearGroups);

export const allByTotalCost = [...evaluatedListings, ...evaluatedSold].sort((a, b) => a.metrics.baseTotalCost - b.metrics.baseTotalCost);
