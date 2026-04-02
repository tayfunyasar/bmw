import { CoupeGasWithSunroof, equipmentRules } from '../data';

// --- Constants & Configuration ---
const EVALUATION_DATE = {
  year: 2026,
  month: 3, // March (0-indexed)
  day: 1
};

const TIME_CONSTANTS = {
  daysInAverageMonth: 30.44,
  millisecondsInADay: 1000 * 60 * 60 * 24
};

const DEPRECIATION_RATES = {
  monthlyInEuros: 138,
  perKmInEuros: 0.092
};

const FEATURE_STATUS = {
  yes: "yes",
  unknown: "unknown"
};

// --- Time Calculations ---
const calculateAgeInMonths = (registrationYear, registrationMonth) => {
  const evaluation = new Date(EVALUATION_DATE.year, EVALUATION_DATE.month, EVALUATION_DATE.day);
  const registration = new Date(registrationYear, registrationMonth, 1);
  
  const ageInDays = (evaluation.getTime() - registration.getTime()) / TIME_CONSTANTS.millisecondsInADay;
  return Math.round(ageInDays / TIME_CONSTANTS.daysInAverageMonth);
};

// --- Depreciation Calculations ---
const calculateDepreciation = (ageInMonths, mileage) => {
  const agePenalty = ageInMonths * DEPRECIATION_RATES.monthlyInEuros;
  const mileagePenalty = Math.round(mileage * DEPRECIATION_RATES.perKmInEuros);
  
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

// --- BPM Calculator (2026 tarief + afschrijvingstabel) ---
const BPM_BRACKETS = [
  { min: 0, max: 77, base: 687, rate: 2 },
  { min: 77, max: 100, base: 841, rate: 82 },
  { min: 100, max: 139, base: 2727, rate: 181 },
  { min: 139, max: 155, base: 9786, rate: 297 },
  { min: 155, max: Infinity, base: 14538, rate: 594 },
];

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

const calculateBpm = (co2, registrationYear, registrationMonth) => {
  if (!co2 || co2 <= 0) return { bpmBruto: null, bpmCalculated: null, depreciationPercent: null };

  const bracket = BPM_BRACKETS.find(b => co2 > b.min && co2 <= b.max) || BPM_BRACKETS[BPM_BRACKETS.length - 1];
  const bpmBruto = bracket.base + ((co2 - bracket.min) * bracket.rate);

  if (!registrationYear || !registrationMonth) return { bpmBruto, bpmCalculated: null, depreciationPercent: null };

  const today = new Date(EVALUATION_DATE.year, EVALUATION_DATE.month, EVALUATION_DATE.day);
  const regDate = new Date(registrationYear, registrationMonth - 1);
  const ageMonths = Math.round((today - regDate) / (TIME_CONSTANTS.millisecondsInADay * TIME_CONSTANTS.daysInAverageMonth));

  const row = BPM_DEPRECIATION_TABLE.find(d => ageMonths >= d.minMonth && ageMonths < d.maxMonth) || BPM_DEPRECIATION_TABLE[BPM_DEPRECIATION_TABLE.length - 1];
  const depPercent = Math.min(row.basePercent + ((ageMonths - row.minMonth) * row.monthlyAdd), 100);
  const bpmCalculated = Math.round(bpmBruto * (100 - depPercent) / 100);

  return { bpmBruto, bpmCalculated, depreciationPercent: Math.round(depPercent * 10) / 10 };
};

// --- Main Calculator ---
export function calculateCarMetrics(car) {
  const [registrationYear, registrationMonth] = car.firstRegistrationYearAndMonth;
  
  // 1. Age & Depreciation
  const ageInMonths = calculateAgeInMonths(registrationYear, registrationMonth);
  const depreciation = calculateDepreciation(ageInMonths, car.mileageKm);
  
  // 2. Base Cost
  const baseTotalCost = car.basePriceEuro + car.estimatedImportTaxEuro;
  
  // 3. Features & Scores
  const evaluatedFeatures = evaluateCarFeatures(car.equipmentFeatures);
  const extraFeaturesValue = calculateFeaturesValue(evaluatedFeatures);
  const featureScores = calculateCriticalFeaturesScore(evaluatedFeatures);
    
  // 4. Final Adjusted Cost
  // Formula: Base Cost + Total Depreciation Penalty - Value of Extra Features
  const adjustedCost = baseTotalCost + depreciation.totalDepreciation - extraFeaturesValue;

  // 5. BPM Calculation
  const bpm = calculateBpm(car.co2EmissionsGramPerKm, registrationYear, registrationMonth);

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
