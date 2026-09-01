import { CoupeGasWithSunroof, equipmentRules, PRICING_CONSTANTS, SCORING, BPM_RATES, colorMeta, interiorMeta, countryCodeOf, dealerListingsByCategory, rootListingsByCategory } from '../data';
import LISTING_FILES from '../data/metadata/LISTING_FILES.json';
import { computeBaseRates, unknownsExpectedValue, unknownsExpectedScore } from './expectedValue.js';
import { listingCreatedAt, listingSoldAt, listingAgeInDays, carListingAgeDays } from './listingAge.js';

const { TIME_CONSTANTS, DEPRECIATION_RATES, BPM_DEFAULT_CO2, BPM_EXEMPT_COUNTRIES, FEATURE_STATUS, OWNER_ADJUSTMENT_EUR } = PRICING_CONSTANTS;
// Değerlendirme tarihi = BUGÜN (dinamik, türetilmiş). Sabit tarih araç yaşını/BPM'i
// dondurup skorları eskitirdi; bu yüzden JSON'da tutulmaz, runtime hesaplanır.
const _now = new Date();
const EVALUATION_DATE = { year: _now.getFullYear(), month: _now.getMonth(), day: _now.getDate() };
// BPM tarife/afschrijving tabloları veri olarak BPM_RATES.json'da; null (üst-dilim) → Infinity.
const BPM_TARIEVEN = BPM_RATES.tarieven;
const BPM_DEPRECIATION_TABLE = BPM_RATES.depreciationTable;

// Model-geneli donanim base-rate'leri (bir kez, aktif referans populasyon uzerinden).
// calculateCarMetrics her arac icin beklenen (base-rate agirlikli) belirsiz deger/skor
// kredisini bununla hesaplar → tum sekmelerde (ana + diesel/rwd/kazali) tutarli.
const equipmentBaseRates = computeBaseRates(CoupeGasWithSunroof, equipmentRules, SCORING.defaultAlpha);

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
  // auditHistory eskiden yeniye sıralı → ilk düşüşün "old"u ilk fiyat, son düşüş en güncel değişiklik.
  let firstPriceEuro = null, lastDropOldEuro = null, lastDropNewEuro = null, lastDropDate = null;
  for (const entry of auditHistory) {
    const change = entry.changes?.basePriceEuro;
    if (change && typeof change.old === 'number' && typeof change.new === 'number' && change.new < change.old) {
      priceDropTotal += change.old - change.new;
      priceDropCount++;
      if (firstPriceEuro === null) firstPriceEuro = change.old; // ilk fiyat (en eski düşüşün öncesi)
      lastDropOldEuro = change.old;   // son düşüş: kaçtan
      lastDropNewEuro = change.new;   // son düşüş: kaça
      lastDropDate = entry.auditDate; // son fiyat değişikliği tarihi
    }
  }
  return { priceDropTotal, priceDropCount, firstPriceEuro, lastDropOldEuro, lastDropNewEuro, lastDropDate };
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

const calcBrutoBpmForYear = (co2, year) => {
  const brackets = BPM_TARIEVEN[year];
  if (!brackets) return Infinity;
  const bracket = brackets.find(b => co2 > b.min && co2 <= (b.max ?? Infinity)) || brackets[brackets.length - 1];
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

  // Tescilsiz arac = SIFIR arac: BPM belirsiz degil, tam tersine kesindir —
  // afschrijving (yas amortismani) %0, brut BPM'in TAMAMI odenir. Eskiden null
  // donuluyordu; sifir araclar UI'da "?" gosterip toplam maliyette BPM'siz
  // (suni ucuz) yarisiyordu (C761/C753 sinifi, 10 arac).
  if (!registrationYear || registrationMonth == null) {
    return { bpmBruto, bpmCalculated: Math.round(bpmBruto), depreciationPercent: 0, tariefYear };
  }

  const today = new Date(EVALUATION_DATE.year, EVALUATION_DATE.month, EVALUATION_DATE.day);
  const regDate = new Date(registrationYear, registrationMonth - 1);
  const ageMonths = Math.round((today - regDate) / (TIME_CONSTANTS.millisecondsInADay * TIME_CONSTANTS.daysInAverageMonth));

  const row = BPM_DEPRECIATION_TABLE.find(d => ageMonths >= d.minMonth && ageMonths < (d.maxMonth ?? Infinity)) || BPM_DEPRECIATION_TABLE[BPM_DEPRECIATION_TABLE.length - 1];
  const depPercent = Math.min(row.basePercent + ((ageMonths - row.minMonth) * row.monthlyAdd), 100);
  const bpmCalculated = Math.round(bpmBruto * (100 - depPercent) / 100);

  return { bpmBruto, bpmCalculated, depreciationPercent: Math.round(depPercent * 10) / 10, tariefYear };
};

// Araç zaten BPM'in tahsil edildiği ülkede satılıyorsa (NL) ithalat/BPM maliyeti YOK —
// tescil orada, vergi ödenmiş. Muaf ülke listesi veri olarak PRICING.json'da.
// bpmBruto referans olarak korunur (muaf olmasa ne öderdik), bpmCalculated 0'a çekilir.
const applyBpmExemption = (car, bpm) => {
  const countryCode = countryCodeOf(car);
  if (!BPM_EXEMPT_COUNTRIES.includes(countryCode)) return bpm;
  return Object.assign({}, bpm, { bpmCalculated: 0, exempt: true, exemptCountry: countryCode });
};

// --- Main Calculator ---
export function calculateCarMetrics(car) {
  const [registrationYear, registrationMonth] = car.firstRegistrationYearAndMonth;
  
  // 1. Age & Depreciation
  const ageInMonths = calculateAgeInMonths(registrationYear, registrationMonth);
  const depreciation = calculateDepreciation(ageInMonths, car.mileageKm);
  
  // 2. BPM Calculation (NL'de satılan araç muaf — bkz. applyBpmExemption)
  const bpm = applyBpmExemption(car, calculateBpm(car.co2EmissionsGramPerKm, registrationYear, registrationMonth));

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
// Çekirdek 4 boyut + ek bonus/ceza → sonuç 0-100'e clamp. Fiyat bilincli
// olarak 35'e yukseltildigi icin cekirdek agirliklarin toplami 110'dur.
// Ağırlıklar/sabitler modelin tek ayar noktası.
// Tüm skorlama sabitleri veri olarak SCORING.json'da (tek ayar noktası); burada türetilir.
const SCORE_WEIGHTS = SCORING.weights;          // {price,equipment,kmAge,desirability}
const SCORE_LABELS = SCORING.labels;
const SERVICE_BONUS = SCORING.bonuses.service;
const WARRANTY_BONUS = SCORING.bonuses.warranty;
const PRIVATE_PENALTY = SCORING.penalties.private;
// Satıcı adında bu kelimelerden biri geçiyorsa "özel satıcı" riski sayılır.
// Liste veri olarak SCORING.json'da — elle "(şahıs)" işaretlenen bayiler de yakalanır.
const PRIVATE_SELLER_KEYWORDS = SCORING.privateSellerKeywords;
const AFTERMARKET_PENALTY = SCORING.penalties.aftermarket;
// Renk skoru (arzu boyutu içinde, hem iç hem dış aynı formül); ağırlık ×25 puana çevirir:
//   favori  → +0.3  (+7.5 puan, iyi renk artı)
//   nötr    → +0.15 (+3.75 puan, bilinmeyen/kayıtsız)
//   disliked→ −0.6  (−15 puan, beyaz dış / kırmızı koltuk → SERT eksi; ceza artırıldı)
// Böylece "iyi renk +, sevilmeyen renk −" tek yerde, çift sayım olmadan uygulanır.
const COLOR_FAV = SCORING.color.favorite;
const COLOR_NEUTRAL = SCORING.color.neutral;
const COLOR_DISLIKED = SCORING.color.disliked;
const colorScore = (pref) => pref === 'favorite' ? COLOR_FAV : pref === 'disliked' ? COLOR_DISLIKED : COLOR_NEUTRAL;

// Yayında bekleme (staleness) cezası — kullanıcı modeli:
//   "yeni olması yüksek puan ALMAZ, ama eski olması düşük puan ALIR".
// Yani yeni ilana BONUS yok (nötr); eskiye kademeli CEZA. Her 5 günde bir basamak.
// SADECE createdTime'a (kesin veri) dayanır → 'ilan ne zaman kayboldu' belirsizliğinden
// etkilenmez; en fazla, satılmış ama henüz SOLD'a taşınmamış bir ilan geçici ceza alır.
export { listingCreatedAt, listingSoldAt, listingAgeInDays, carListingAgeDays };

const STALENESS_STEP_DAYS = SCORING.staleness.stepDays;
const STALENESS_STEP_PENALTY = SCORING.staleness.stepPenalty;
const STALENESS_CAP = SCORING.staleness.cap;

// İlan yaşı helper'ları ayrı, bağımlılıksız modülde (test edilebilir olsun diye).
// Kademeli ceza: floor(gün / 5) × STEP, CAP ile sınırlı. 0-5 gün → 0 (yeni, cezasız).
const stalenessPenalty = (ageDays) => {
  if (ageDays == null) return 0;
  const steps = Math.floor(ageDays / STALENESS_STEP_DAYS);
  return Math.min(STALENESS_CAP, steps * STALENESS_STEP_PENALTY);
};

// Exact fiyat skoru: ucuz = pozitif, €66K = notr, butce ustu = NEGATIF.
// €42K ve alti +1 (= tam fiyat agirligi), €66K 0, €90K ve ustu -1
// (= tam fiyat agirligi kadar eksi puan).
// Boylece €66.001 ile €100K ayni 0 puani almaz; butce asimi arttikca ceza da
// dogrusal artar. Ayrica ayri bir butce cezasi YOK — ayni maliyet iki kez sayilmaz.
const PRICE_FLOOR = SCORING.priceFloor;
// Bütçe tavanı — tek kaynak SCORING.json; priceScore, bütçe-aşımı cezası ve
// recommendations.js filtreleri (💎/🔍/📉) hep bunu kullanır.
export const BUDGET_MAX = SCORING.budgetMax;
const priceScore = (cost) => Math.max(-1, Math.min(1, (BUDGET_MAX - cost) / (BUDGET_MAX - PRICE_FLOOR)));

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
    // Yüzdeliğin KARESİ: sabit km barajı yok, ceza havuza göre dinamik ve sürekli —
    // yıpranma yüzdeliği kötüleştikçe puan karesel (progresif) düşer.
    const kmAgePct = kmAgeScorer(m.totalDepreciation);
    const kmAgeN = kmAgePct * kmAgePct;
    const lci = car.modelGeneration === 'LCI' ? SCORING.lci : 0;
    const extC = colorScore(colorMeta(car.exteriorColorName)?.preference);
    const intC = colorScore(interiorMeta(car.interiorColorName)?.preference);
    // Üst sınır 1; alt sınır yok — iki sevilmeyen renk desirN'i negatife çekebilir (ceza).
    const desirN = Math.min(lci + extC + intC, 1);

    // Ek puanlar (bonus/ceza) — hem tooltip breakdown'a hem tüm kategori skorlarına.
    const extras = [];
    if (car.service?.type === 'yes') extras.push({ label: 'Tam servis', delta: SERVICE_BONUS, formula: 'belgeli servis bonusu' });
    if (car.warranty?.exists === 'yes' || car.warranty?.exists === true) extras.push({ label: 'Garanti', delta: WARRANTY_BONUS, formula: 'aktif garanti bonusu' });
    const seller = car.sellerTypeOrName?.toLowerCase() || '';
    if (PRIVATE_SELLER_KEYWORDS.some(k => seller.includes(k))) extras.push({ label: 'Özel satıcı', delta: -PRIVATE_PENALTY, formula: 'risk cezası' });
    if (car.listingAdditionalFeatures?.some(f => f.toLowerCase().includes('aftermarket'))) extras.push({ label: 'Aftermarket', delta: -AFTERMARKET_PENALTY, formula: 'risk cezası' });
    const ageDays = carListingAgeDays(car);
    const stale = stalenessPenalty(ageDays);
    if (stale > 0) extras.push({ label: 'Yayında bekleme', delta: -stale, formula: `${ageDays} ${car.isSold ? 'günde satıldı' : 'gündür yayında'} → her ${STALENESS_STEP_DAYS} günde −${STALENESS_STEP_PENALTY}` });
    const adj = extras.reduce((s, x) => s + x.delta, 0);
    const clamp100 = (v) => Math.max(0, Math.min(100, round1(v)));

    // 🏆 Genel (holistik, senin ağırlıkların — renk baskın). Tooltip breakdown bununla.
    car.totalScore = clamp100(priceN * W.price + equipN * W.equipment + kmAgeN * W.kmAge + desirN * W.desirability + adj);
    // 💰 Değer: GERÇEK ORAN — donanım€ / toplam maliyet€ (bang-for-buck). Bütçe aşımı adj ile cezalanır.
    car.valueScore = clamp100((m.expectedFeaturesValue / m.baseTotalCost) * 100 + adj);

    car.curatorPickBadge = '';
    car.scoreBreakdown = [
      { label: SCORE_LABELS.price,
        // Butceyi birkac euro bile gecse tek ondalik yuvarlama "-0"/"0" gostermesin.
        delta: m.baseTotalCost > BUDGET_MAX ? Math.min(-0.1, round1(priceN * W.price)) : round1(priceN * W.price),
        formula: `${eur(m.baseTotalCost)} → (66K−toplam maliyet)/24K = ${priceN.toFixed(2)} × ${W.price}` },
      { label: SCORE_LABELS.equipment, delta: round1(equipN * W.equipment), formula: `${eur(m.expectedFeaturesValue)} / ${eur(MAX_FEATURES_VALUE)} → ${equipN.toFixed(2)} × ${W.equipment}` },
      { label: SCORE_LABELS.kmAge, delta: round1(kmAgeN * W.kmAge), formula: `yıpranma ${eur(m.totalDepreciation)} → yüzdelik ${kmAgePct.toFixed(2)}² = ${kmAgeN.toFixed(2)} × ${W.kmAge}` },
      { label: SCORE_LABELS.desirability, delta: round1(desirN * W.desirability), formula: `LCI ${lci} + dış ${extC} + iç ${intC} → ${desirN.toFixed(2)} × ${W.desirability}` },
      ...extras,
    ];
  });

  // Tek-kazanan rozetler yalnızca ALINABILIR araçlar arasından (satılmış/kazalı araç rozet almaz;
  // GC/Cabrio gibi huni-dışı kategoriler de rozet yarışına girmez — temiz coupe-sunroof havuzu).
  // Her rozet, kendi kategorisinin skoruyla seçilir (kategoriler farklı sıralıyor → farklı kazanan).
  const buyable = evaluated.filter(c => !c.isSold && !c.isKazali && (!c.sourceCategory || c.sourceCategory === 'COUPE_GAS_WITH_SUNROOF'));
  const bestSpec = [...buyable].sort((a,b) => b.metrics.expectedFeaturesValue - a.metrics.expectedFeaturesValue)[0]; // 👑 donanım (€)
  const topPick = [...buyable].sort((a,b) => b.totalScore - a.totalScore)[0];        // 🏆 genel
  const budgetPick = [...buyable].sort((a,b) => b.valueScore - a.valueScore)[0];     // 💰 değer (oran)
  const dealPick = [...buyable]                                                       // 💎 gerçek fırsat (düşük=iyi)
    .filter(c => c.metrics.baseTotalCost <= BUDGET_MAX)
    .sort((a,b) => a.metrics.expectedDealScore - b.metrics.expectedDealScore)[0];
  const upsidePick = [...buyable]                                                      // 🔍 gizli değer (belirsiz donanım)
    .filter(c => c.metrics.unknownsCount > 0 && c.metrics.baseTotalCost <= BUDGET_MAX)
    .sort((a,b) => b.metrics.unknownsPotentialValue - a.metrics.unknownsPotentialValue)[0];
  const dropPick = [...buyable]                                                        // 📉 fiyat düşüşü (€, sık kıran tiebreak)
    .filter(c => c.metrics.priceDropTotal > 0 && c.metrics.baseTotalCost <= BUDGET_MAX)
    .sort((a,b) => (b.metrics.priceDropTotal - a.metrics.priceDropTotal) || (b.metrics.priceDropCount - a.metrics.priceDropCount))[0];

  if (bestSpec) bestSpec.curatorPickBadge += '👑';
  if (topPick && !topPick.curatorPickBadge.includes('🏆')) topPick.curatorPickBadge += '🏆';
  if (budgetPick && !budgetPick.curatorPickBadge.includes('💰')) budgetPick.curatorPickBadge += '💰';
  if (dealPick && !dealPick.curatorPickBadge.includes('💎')) dealPick.curatorPickBadge += '💎';
  if (upsidePick && !upsidePick.curatorPickBadge.includes('🔍')) upsidePick.curatorPickBadge += '🔍';
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

// Alim havuzu KATEGORI SECMELI: ulke-dislamalari haric TUM kategoriler — SOLD
// arsivleri DAHIL — (kok + ayni adli bayi klasorleri) havuza girer; hangilerinin
// UI'da gorunecegi filtre cubugundaki checkbox'lardan secilir (carFilters.categories).
// Her araca sourceCategory islenir; KAZALI kategorileri isKazali (major gizli / LCI
// kurali carFilters'ta), _SOLD kategorileri isSold alir. Dosyalar yerinde — salt okuma.
export const selectableCategories = LISTING_FILES.allCategories.filter(c =>
  !Object.values(LISTING_FILES.countryExcludedCategories).includes(c));
// Varsayilan secim = temiz coupe havuzu + kazalilari; diger kategoriler checkbox'tan acilir.
export const DEFAULT_SELECTED_CATEGORIES = ['COUPE_GAS_WITH_SUNROOF', 'COUPE_GAS_WITH_SUNROOF_KAZALI'];

const poolCars = attachMetrics(selectableCategories.flatMap(category => {
  const cars = [...(rootListingsByCategory[category] || []), ...(dealerListingsByCategory[category] || [])];
  const flags = {
    ...(category.includes('KAZALI') ? { isKazali: true } : {}),
    ...(category.endsWith('_SOLD') ? { isSold: true } : {}),
  };
  return cars.map(car => Object.assign({}, car, { sourceCategory: category }, flags));
}));

// Referans dagilim + rozet adaylari = temiz coupe-sunroof aktifleri (bayi dahil) —
// GC/Cabrio/kazali/satilmis havuza girse de fiyat istatistigini ve rozetleri etkilemez.
const activeCars = poolCars.filter(c => c.sourceCategory === 'COUPE_GAS_WITH_SUNROOF');

// Öneri skorları TEK referans dağılıma (aktif pazar) göre hesaplanır → sold/kazalı araçlar
// aktiflerle kıyaslanabilir. Rozetler yalnız alınabilir araçlarda (fonksiyon içinde).
assignRecommendations(poolCars, activeCars);

export const evaluatedListings = activeCars;
export const yearGroups = groupListingsByYear(poolCars);
export const sortedYears = extractSortedYears(yearGroups);

export const allByTotalCost = [...poolCars].sort((a, b) => a.metrics.baseTotalCost - b.metrics.baseTotalCost);
