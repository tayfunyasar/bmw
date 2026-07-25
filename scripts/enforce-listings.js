import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Şema (anahtar sırası) + dosya listesi veri olarak LISTING_FILES.json'da (config-driven).
const LISTING_FILES = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/LISTING_FILES.json'), 'utf8'));
const ROOT_KEYS_ORDER = LISTING_FILES.rootKeysOrder;
const EQUIP_KEYS_ORDER = LISTING_FILES.equipKeysOrder;

const listingsDir = path.resolve(__dirname, '../src/data/listings');
const files = LISTING_FILES.enforceFiles;

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
