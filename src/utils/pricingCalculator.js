import { CoupeGasWithSunroof, equipmentRules, PRICING_CONSTANTS } from '../data';

const { EVALUATION_DATE, TIME_CONSTANTS, DEPRECIATION_RATES, BPM_DEFAULT_CO2, FEATURE_STATUS } = PRICING_CONSTANTS;

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
  // Sadece bilinen (yes/no) donanımlar üzerinden oran hesapla
  const knownFeatures = evaluatedFeatures.filter(f => f.value === "yes" || f.value === "no");
  const maxPossibleValue = evaluatedFeatures.reduce((sum, f) => sum + (f.price * f.score), 0);

  if (knownFeatures.length === 0 || maxPossibleValue === 0) return 0;

  const knownYesValue = knownFeatures
    .filter(f => f.value === "yes")
    .reduce((sum, f) => sum + (f.price * f.score), 0);
  const knownMaxValue = knownFeatures
    .reduce((sum, f) => sum + (f.price * f.score), 0);

  // Oran: bilinen donanımlar arasındaki yes oranını toplam potansiyele uygula
  const ratio = knownMaxValue > 0 ? knownYesValue / knownMaxValue : 0;
  return Math.round(maxPossibleValue * ratio);
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

  // 5. Final Adjusted Cost
  const adjustedCost = baseTotalCost + depreciation.totalDepreciation - extraFeaturesValue;

  return Object.assign({ ageInMonths }, depreciation, {
    baseTotalCost,
    evaluatedFeatures,
    extraFeaturesValue,
    criticalFeaturesScore: featureScores.currentScore,
    maxCriticalScore: featureScores.maximumPossibleScore,
    adjustedCost,
    bpmCalculation: bpm
  });
}

const assignRecommendations = (evaluated) => {
  evaluated.forEach(car => {
     let score = 0;
     // Donanım (30%): Kritik donanım sayısı
     score += (car.metrics.criticalFeaturesScore * 1.5);
     
     // Fiyat/değer (25%): Düzeltilmiş maliyet (düşük = iyi)
     score += ((65000 - car.metrics.adjustedCost) / 1000); 
     
     // Güvenilirlik (20%): 1 sahip, tam servis, bayi puanı
     if (car.numberOfPreviousOwners === '1') score += 3;
     if (car.service?.type === 'yes') score += 2;
     
     if (car.sellerTypeOrName?.includes('★')) {
       const ratingMatch = car.sellerTypeOrName.match(/★([\d.]+)/);
       if (ratingMatch) score += parseFloat(ratingMatch[1]);
     }
     
     // Risk faktörleri (15%):
     if (car.sellerTypeOrName?.toLowerCase().includes('private') || car.sellerTypeOrName?.toLowerCase().includes('özel') || car.sellerTypeOrName?.toLowerCase().includes('privat')) {
       score -= 2;
     }
     if (car.listingAdditionalFeatures?.some(feat => feat.toLowerCase().includes('aftermarket'))) {
       score -= 2;
     }
     
     // Bonus (10%): LCI, M Brake, vb.
     if (car.modelGeneration === 'LCI') score += 2;
     if (car.equipmentFeatures?.S2NHA === 'yes') score += 1;
     if (car.equipmentFeatures?.S536A === 'yes') score += 2;
     
     // Reset badge to avoid duplicates across re-renders
     car.curatorPickBadge = '';
     car.totalScore = score;
  });

  const bestSpec = [...evaluated].sort((a,b) => b.metrics.criticalFeaturesScore - a.metrics.criticalFeaturesScore)[0];
  const topPick = [...evaluated].sort((a,b) => b.totalScore - a.totalScore)[0];
  const budgetPick = [...evaluated].filter(c => c.metrics.baseTotalCost < 57000).sort((a,b) => b.totalScore - a.totalScore)[0];
  const balancedPick = [...evaluated].filter(c => c.metrics.criticalFeaturesScore >= 4 && c.metrics.baseTotalCost <= 58000).sort((a,b) => b.totalScore - a.totalScore)[0];

  if (bestSpec) bestSpec.curatorPickBadge += '👑';
  if (topPick && !topPick.curatorPickBadge.includes('🏆')) topPick.curatorPickBadge += '🏆';
  if (budgetPick && !budgetPick.curatorPickBadge.includes('💰')) budgetPick.curatorPickBadge += '💰';
  if (balancedPick && !balancedPick.curatorPickBadge.includes('⚖️')) balancedPick.curatorPickBadge += '⚖️';

  // If a car has no badges, reset to null
  evaluated.forEach(car => {
    if (car.curatorPickBadge === '') car.curatorPickBadge = null;
  });

  return evaluated;
};

// --- Data Aggregation ---
const createEvaluatedListings = (listings) => {
  const evaluated = listings.map((car, index) => Object.assign({}, car, { 
    metrics: calculateCarMetrics(car), 
    originalIndex: index 
  })).sort((a, b) => a.metrics.baseTotalCost - b.metrics.baseTotalCost);
  
  return assignRecommendations(evaluated);
};

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

export const evaluatedListings = createEvaluatedListings(CoupeGasWithSunroof);
export const yearGroups = groupListingsByYear(evaluatedListings);
export const sortedYears = extractSortedYears(yearGroups);
