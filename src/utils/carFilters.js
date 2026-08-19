import { hasDislikedColor, equipmentRules } from '../data';

// 2-yıldızlı (score===2) kritik donanım kodları — config'den türer (hardcode liste yok).
const STAR2_CODES = equipmentRules.filter(r => r.score === 2).map(r => r.code);

// Filtre çubuğundaki kriterler — TEK kaynak. Hem öneri havuzu (App) hem tablolar (MainTabs)
// aynı predicate'i kullanır (DRY). Renk/KM/bütçe/LCI/2-yıldız filtrelerinin mantığı yalnızca burada.
// lciOnly:      kesin LCI + "LCI olma ihtimali olan" (belirsiz) araçlar; kesin Pre-LCI elenir.
// twoStarSure:  tüm 2-yıldızlı donanımlar KESİN var (yes) ya da belirsiz (?/unknown) olan araçlar;
//               herhangi biri KESİN yok (no) ise elenir. (LCI ile aynı mantık: yes+? dahil, no hariç.)
// showKazali:   kazalı araçların (isKazali) görünürlüğü. Açıkken bile: kazaliSeverity==='major'
//               (büyük hasar, kazali:severity ile işaretlenir) DAİMA gizli; alan yoksa ufak sayılır.
//               Ayrıca kazalı araç yalnızca LCI (veya LCI'sı belirsiz) ise gösterilir —
//               kesin Pre-LCI kazalı hiç gösterilmez (lciOnly ile aynı nesil mantığı).
const isLciOrUncertain = (car) => car.modelGeneration === 'LCI' || car.modelGenerationCertain === false;
export const carMatchesFilters = (car, { showDisliked = false, kmMax = 0, budgetMax = 0, lciOnly = false, twoStarSure = false, showKazali = true } = {}) =>
  (!car.isKazali || (showKazali && car.kazaliSeverity !== 'major' && isLciOrUncertain(car))) &&
  (showDisliked || !hasDislikedColor(car)) &&
  (!kmMax || car.mileageKm < kmMax) &&
  (!budgetMax || car.metrics.baseTotalCost <= budgetMax) &&
  (!lciOnly || isLciOrUncertain(car)) &&
  (!twoStarSure || STAR2_CODES.every(code => car.equipmentFeatures?.[code] !== 'no'));
