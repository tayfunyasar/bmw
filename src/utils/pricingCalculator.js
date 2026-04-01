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
  return evaluatedFeatures
    .filter(feature => feature.value === FEATURE_STATUS.yes && feature.price > 0)
    .reduce((totalValue, feature) => {
      // Donanımın kendi fiyatını ve puanının katsayısını hesaplıyoruz.
      // Sizin isteğinize göre 0 olan puan 1 yapılmıyor. Neyse o kullanılıyor.
      // Dolayısıyla (feature.price * feature.score) olarak hesaplanır.
      const multiplier = feature.score;
      return totalValue + (feature.price * multiplier);
    }, 0);
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
  
  return Object.assign({ ageInMonths }, depreciation, {
    baseTotalCost, 
    evaluatedFeatures, 
    extraFeaturesValue, 
    criticalFeaturesScore: featureScores.currentScore, 
    maxCriticalScore: featureScores.maximumPossibleScore, 
    adjustedCost 
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
