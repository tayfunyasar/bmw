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
import LISTING_FILES from './metadata/LISTING_FILES.json';
import bpmData from './metadata/BPM_DATA.json';
import dealersData from './metadata/DEALERS.json';
import bookmarks from './user_data/BOOKMARKS.json';

// Ilanlar arac-basina-dosya yerlesiminde: ./listings/<KATEGORI>/<listingId>.json (kok)
// ve ./listings/<SITE>/<KATEGORI>/<listingId>.json (bayi). Segment sayisi ayirir;
// yeni kategori/site klasoru acildiginda buraya satir eklemek GEREKMEZ (Vite glob;
// Node script'leri bu dosyayi kullanmaz, onlar scripts/lib/listings-store.js ile tarar).

// Dislanan ulke kategorileri UI'a HIC girmez — config tek kaynak (LISTING_FILES.json).
const EXCLUDED_CATEGORIES = new Set(Object.values(LISTING_FILES.countryExcludedCategories));
const idNum = (car) => parseInt(String(car.listingId ?? '').match(/(\d+)$/)?.[1] ?? '0', 10);
const byListingId = (a, b) => idNum(a) - idNum(b) || String(a.listingId).localeCompare(String(b.listingId));

// Kok araclar: ./listings/<KATEGORI>/<ID>.json (2 segment)
const rootModules = import.meta.glob('./listings/*/*.json', { eager: true });
const rootByCategory = {};
for (const [p, mod] of Object.entries(rootModules)) {
  const category = p.split('/')[2];
  if (EXCLUDED_CATEGORIES.has(category)) continue;
  (rootByCategory[category] = rootByCategory[category] || []).push(mod.default);
}
Object.values(rootByCategory).forEach(arr => arr.sort(byListingId));
const cat = (name) => rootByCategory[name] || [];
// Kategori adı → kök araç listesi (dışlanan ülkeler zaten filtreli) — kategori
// seçmeli havuz (pricingCalculator) buradan beslenir.
export const rootListingsByCategory = rootByCategory;

const CoupeGasWithSunroof = cat('COUPE_GAS_WITH_SUNROOF');
const CoupeDieselWithSunroof = cat('COUPE_DIESEL_WITH_SUNROOF');
const soldGasListings = cat('COUPE_GAS_WITH_SUNROOF_SOLD');
const rwdSoldWithSunroofListings = cat('COUPE_GAS_RWD_WITH_SUNROOF_SOLD');
const rwdSoldWithoutSunroofListings = cat('COUPE_GAS_RWD_WITHOUT_SUNROOF_SOLD');
const noSunroofGas = cat('COUPE_GAS_WITHOUT_SUNROOF');
const rwdGasWithSunroofListings = cat('COUPE_GAS_RWD_WITH_SUNROOF');
const rwdGasWithoutSunroofListings = cat('COUPE_GAS_RWD_WITHOUT_SUNROOF');
const deletedCars = cat('DELETED_CARS');
const granCoupe = cat('GRAN_COUPE');
const granCoupeKazaliListings = cat('GRAN_COUPE_KAZALI');
const cabrioListings = cat('CABRIO');
const cabrioKazaliListings = cat('CABRIO_KAZALI');
const cakalListings = cat('COUPE_GAS_WITH_SUNROOF_CAKAL');
const kazaliListings = cat('COUPE_GAS_WITH_SUNROOF_KAZALI');

// Bayi araclari: ./listings/<SITE>/<KATEGORI>/<ID>.json (3 segment). Kategori adina gore gruplanir.
const dealerModules = import.meta.glob('./listings/*/*/*.json', { eager: true });
export const dealerListingsByCategory = {};
export const dealerListingsAll = [];
for (const [p, mod] of Object.entries(dealerModules)) {
  const category = p.split('/')[3];
  (dealerListingsByCategory[category] = dealerListingsByCategory[category] || []).push(mod.default);
  dealerListingsAll.push(mod.default);
}
Object.values(dealerListingsByCategory).forEach(arr => arr.sort(byListingId));
dealerListingsAll.sort(byListingId);

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
  cabrioKazaliListings,
  cakalListings,
  kazaliListings,
  bpmData,
  dealersData,
  bookmarks,

  actionPlan,
  emails
};