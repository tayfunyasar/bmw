import { hasDislikedExterior, hasDislikedInterior, equipmentRules } from '../data';

// 2-yıldızlı (score===2) kritik donanım kodları — config'den türer (hardcode liste yok).
const STAR2_CODES = equipmentRules.filter(r => r.score === 2).map(r => r.code);

// Filtre çubuğundaki kriterler — TEK kaynak. Hem öneri havuzu (App) hem tablolar (MainTabs)
// aynı predicate'i kullanır (DRY). Renk/KM/bütçe/LCI/2-yıldız filtrelerinin mantığı yalnızca burada.
// Renk anahtarları AYRI: showDislikedExt (dış) ve showDislikedInt (iç) bağımsız çalışır —
//               biri açıkken diğerinin sevilmeyen rengi hâlâ eler.
// lciOnly:      kesin LCI + "LCI olma ihtimali olan" (belirsiz) araçlar; kesin Pre-LCI elenir.
// twoStarSure:  tüm 2-yıldızlı donanımlar KESİN var (yes) ya da belirsiz (?/unknown) olan araçlar;
//               herhangi biri KESİN yok (no) ise elenir. (LCI ile aynı mantık: yes+? dahil, no hariç.)
// Kazalı kuralı: kategori checkbox'ı KAZALI'yı görünür yapınca hasar boyutu filtresi
//               (kazaliSeverity) devreye girer: 'minor' (varsayılan; alan yoksa ufak
//               sayılır), 'major' ya da 'all'. Nesil koşulu sabittir: yalnızca LCI
//               (veya LCI'sı belirsiz) kazalılar gösterilir — kesin Pre-LCI asla.
// categories:   seçili kategori Set'i (checkbox'lar). Araç YALNIZCA sourceCategory'si
//               seçiliyse görünür — istisna yok. SOLD kategorileri de checkbox'ta seçilebilir
//               (varsayılan seçimde kapalı); işaretlenirse satılmışlar kırmızı satır olarak gelir.
const isLciOrUncertain = (car) => car.modelGeneration === 'LCI' || car.modelGenerationCertain === false;
const severityOf = (car) => car.kazaliSeverity === 'major' ? 'major' : 'minor';
export const carMatchesFilters = (car, { showDislikedExt = false, showDislikedInt = false, kmMax = 0, budgetMax = 0, lciOnly = false, twoStarSure = false, categories = null, kazaliSeverity = 'minor' } = {}) =>
  (!categories || categories.has(car.sourceCategory)) &&
  (!car.isKazali || ((kazaliSeverity === 'all' || severityOf(car) === kazaliSeverity) && isLciOrUncertain(car))) &&
  (showDislikedExt || !hasDislikedExterior(car)) &&
  (showDislikedInt || !hasDislikedInterior(car)) &&
  (!kmMax || car.mileageKm < kmMax) &&
  (!budgetMax || car.metrics.baseTotalCost <= budgetMax) &&
  (!lciOnly || isLciOrUncertain(car)) &&
  (!twoStarSure || STAR2_CODES.every(code => car.equipmentFeatures?.[code] !== 'no'));
