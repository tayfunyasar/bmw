import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_KEYS_ORDER = [
  'listingId',
  'listingUrl',
  'dealerListingUrl',
  'mobileDeId',
  'exteriorColorName',
  'interiorColorName',
  'drivetrainType',
  'drivetrainCertain',
  'drivetrainReason',
  'basePriceEuro',
  'estimatedImportTaxEuro',
  'mileageKm',
  'firstRegistrationYearAndMonth',
  'numberOfPreviousOwners',
  'warranty',
  'service',
  'nextInspectionDate',
  'sellerTypeOrName',
  'modelGeneration',
  'co2EmissionsGramPerKm',
  'listingLocation',
  'curatorPickBadge',
  'curatorPersonalNotes',
  'listingDescriptionNotes',
  'listingAdditionalFeatures',
  'equipmentFeatures',
  'listingDates',
  'overrideFeatures',
  'auditHistory',
  'cardThemeColorHex',
  'aiCommentary'
];

const EQUIP_KEYS_ORDER = [
  'S403A', 'S5AZA', 'S5AUA', 'S688A', 'S2T4A',
  'S610A', 'S5DN_360', 'KGNL', 'S322A', 'S2VFA', 'S459A',
  'S5DNA', 'S6U3A', 'S715A', 'S2VLA', 'S494A', 'S248A',
  'S420A', 'S1MAA', 'S5ACA', 'S6C4A', 'S430A', 'S4AWA',
  'S775A', 'S493A', 'S536A', 'S2NHA', 'S3ACA', 'S3ADA', 'S3AGA',
  'S488A', 'S521A', 'S524A', 'S265A', 'S216A', 'S302A', 'S4NHA'
];

const listingsDir = path.resolve(__dirname, '../src/data/listings');
const files = [
  'COUPE_GAS_WITH_SUNROOF.json', 
  'COUPE_GAS_WITHOUT_SUNROOF.json', 
  'COUPE_GAS_WITH_SUNROOF_SOLD.json',
  'COUPE_GAS_RWD_WITH_SUNROOF_SOLD.json',
  'COUPE_GAS_RWD_WITHOUT_SUNROOF_SOLD.json',
  'COUPE_DIESEL_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITHOUT_SUNROOF.json',
  'DELETED_CARS.json',
  'GRAN_COUPE.json',
  'CABRIO.json'
];

const isFix = process.argv.includes('--fix');
let hasError = false;

function formatListing(listing, index, filename) {
  const newListing = {};
  const carLabel = `${listing.listingId || '?'}/${listing.mobileDeId || '?'}`;

  // 1. Check for extra keys not in our schema
  const extraKeys = Object.keys(listing).filter(k => !ROOT_KEYS_ORDER.includes(k));
  if (extraKeys.length > 0) {
    console.error(`Error: [${carLabel}] ${filename} index ${index} — unknown root keys: ${extraKeys.join(', ')}`);
    hasError = true;
  }

  // 2. Build the new object strictly in order
  for (const key of ROOT_KEYS_ORDER) {
    if (key === 'equipmentFeatures') {
      const newEquip = {};
      const oldEquip = listing.equipmentFeatures || {};

      const extraEquipKeys = Object.keys(oldEquip).filter(k => !EQUIP_KEYS_ORDER.includes(k));
      if (extraEquipKeys.length > 0) {
        console.error(`Error: [${carLabel}] ${filename} index ${index} — unknown equipment features: ${extraEquipKeys.join(', ')}`);
        hasError = true;
      }

      for (const eqKey of EQUIP_KEYS_ORDER) {
        newEquip[eqKey] = oldEquip[eqKey] !== undefined ? oldEquip[eqKey] : 'unknown';
      }
      newListing[key] = newEquip;
    } else if (key === 'dealerListingUrl') {
      if (listing.dealerListingUrl) {
        newListing[key] = listing.dealerListingUrl;
      }
    } else if (key === 'listingDates') {
      if (listing.listingDates) {
        newListing[key] = {
          createdTime: listing.listingDates.createdTime || null,
          modifiedTime: listing.listingDates.modifiedTime || null,
          renewedTime: listing.listingDates.renewedTime || null
        };
      }
    } else if (key === 'overrideFeatures') {
      if (listing.overrideFeatures) {
        newListing[key] = listing.overrideFeatures;
      }
    } else if (key === 'service') {
      const oldService = listing.service || {};
      newListing[key] = {
        type: oldService.type || 'unknown',
        history: Array.isArray(oldService.history) ? oldService.history : []
      };
    } else if (key === 'warranty') {
      const oldWarranty = listing.warranty || {};
      newListing[key] = {
        exists: oldWarranty.exists || 'unknown'
      };
    } else {
      // For standard keys: if not present, set to null (or empty array if it's a known array field)
      if (listing[key] !== undefined) {
        newListing[key] = listing[key];
      } else {
        const arrayFields = ['curatorPersonalNotes', 'listingDescriptionNotes', 'listingAdditionalFeatures', 'auditHistory'];
        if (arrayFields.includes(key)) {
          newListing[key] = [];
        } else {
          newListing[key] = null;
        }
      }
    }
  }
  
  return newListing;
}

const seenIds = new Map();

for (const file of files) {
  const filePath = path.join(listingsDir, file);
  const rawData = fs.readFileSync(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(rawData);
  } catch {
    console.error(`Failed to parse ${file}`);
    process.exit(1);
  }
  
  const formattedData = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const formattedItem = formatListing(item, i, file);
    const id = formattedItem.mobileDeId;
    
    if (id) {
      if (seenIds.has(id)) {
        console.error(`Error: Duplicate mobileDeId ${id} found in ${file} (previously in ${seenIds.get(id)}).`);
        hasError = true;
        if (isFix) {
          // If in fix mode, we drop the duplicate
          continue;
        }
      } else {
        seenIds.set(id, file);
      }
    }
    formattedData.push(formattedItem);
  }
  
  const newDataStr = JSON.stringify(formattedData, null, 2) + '\n';
  
  if (newDataStr !== rawData) {
    if (isFix) {
      fs.writeFileSync(filePath, newDataStr, 'utf-8');
      console.log(`Fixed formatting and removed duplicates in ${file}`);
    } else {
      console.error(`Error: ${file} does not match strict formatting or has duplicates.`);
      hasError = true;
    }
  } else {
    console.log(`Check passed for ${file}`);
  }
}

if (hasError && !isFix) {
  console.error('\nListings formatting error or duplicates found! Please run "npm run format:data" to fix.');
  process.exit(1);
} else {
  console.log('\nAll listings are strictly formatted and uniquely indexed by mobileDeId!');
}
