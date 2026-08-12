export * from './colors.js';
export * from './countries.js';
import UI_COLORS from './constants/THEME.json';
import PRICING_CONSTANTS from './constants/PRICING.json';
import SCORING from './constants/SCORING.json';
import APP from './constants/APP.json';
import BPM_RATES from './metadata/BPM_RATES.json';
import COUNTRY_FLAGS from './metadata/COUNTRY_FLAGS.json';
import RECOMMENDATIONS from './metadata/RECOMMENDATIONS.json';
import equipmentRules from './metadata/EQUIPMENT_RULES.json';
import CoupeGasWithSunroof from './listings/COUPE_GAS_WITH_SUNROOF.json';
import CoupeDieselWithSunroof from './listings/COUPE_DIESEL_WITH_SUNROOF.json';
import soldGasListings from './listings/COUPE_GAS_WITH_SUNROOF_SOLD.json';
import rwdSoldWithSunroofListings from './listings/COUPE_GAS_RWD_WITH_SUNROOF_SOLD.json';
import rwdSoldWithoutSunroofListings from './listings/COUPE_GAS_RWD_WITHOUT_SUNROOF_SOLD.json';
import noSunroofGas from './listings/COUPE_GAS_WITHOUT_SUNROOF.json';
import rwdGasWithSunroofListings from './listings/COUPE_GAS_RWD_WITH_SUNROOF.json';
import rwdGasWithoutSunroofListings from './listings/COUPE_GAS_RWD_WITHOUT_SUNROOF.json';
import deletedCars from './listings/DELETED_CARS.json';
import granCoupe from './listings/GRAN_COUPE.json';
import granCoupeKazaliListings from './listings/GRAN_COUPE_KAZALI.json';
import cabrioListings from './listings/CABRIO.json';
import cakalListings from './listings/COUPE_GAS_WITH_SUNROOF_CAKAL.json';
import kazaliListings from './listings/COUPE_GAS_WITH_SUNROOF_KAZALI.json';
import bpmData from './metadata/BPM_DATA.json';
import dealersData from './metadata/DEALERS.json';
import bookmarks from './user_data/BOOKMARKS.json';

// Bayi sitesi klasorleri (WELLER/, AHG/, ...) — import.meta.glob ile OTOMATIK toplanir.
// Yeni site klasoru acildiginda buraya satir eklemek GEREKMEZ (Vite ozelligi; Node
// script'leri bu dosyayi kullanmaz, onlar fs ile tarar). Kategori adina gore gruplanir.
const dealerModules = import.meta.glob('./listings/*/*.json', { eager: true });
export const dealerListingsByCategory = {};
export const dealerListingsAll = [];
for (const [path, mod] of Object.entries(dealerModules)) {
  const category = path.split('/').pop().replace(/\.json$/, '');
  const cars = mod.default || [];
  (dealerListingsByCategory[category] = dealerListingsByCategory[category] || []).push(...cars);
  dealerListingsAll.push(...cars);
}

import actionPlan from './user_data/ACTION_PLAN.json';
import emails from './user_data/EMAILS.json';

export {
  UI_COLORS,
  PRICING_CONSTANTS,
  SCORING,
  APP,
  BPM_RATES,
  COUNTRY_FLAGS,
  RECOMMENDATIONS,
  equipmentRules,
  CoupeGasWithSunroof,
  CoupeDieselWithSunroof,
  soldGasListings,
  rwdSoldWithSunroofListings,
  rwdSoldWithoutSunroofListings,
  rwdGasWithSunroofListings,
  rwdGasWithoutSunroofListings,
  noSunroofGas,
  deletedCars,
  granCoupe,
  granCoupeKazaliListings,
  cabrioListings,
  cakalListings,
  kazaliListings,
  bpmData,
  dealersData,
  bookmarks,

  actionPlan,
  emails
};