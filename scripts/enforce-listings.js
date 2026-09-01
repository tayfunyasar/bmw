import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { listingsDir, dealerCategories, carPath } from './lib/listings-store.js';
import { LISTING_ID_PATTERN, isValidListingId } from './lib/listing-id.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Şema (anahtar sırası) + kategori listesi veri olarak LISTING_FILES.json'da (config-driven).
const LISTING_FILES = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/LISTING_FILES.json'), 'utf8'));
const ROOT_KEYS_ORDER = LISTING_FILES.rootKeysOrder;
// Yalnizca DOLU oldugunda yazilan alanlar (yoksa anahtar hic olusmaz) — config'ten.
const OPTIONAL_KEYS = new Set(LISTING_FILES.optionalRootKeys);
// Eksikse [] ile doldurulan dizi alanlari — config'ten.
const ARRAY_KEYS = new Set(LISTING_FILES.arrayRootKeys);
const EQUIP_KEYS_ORDER = LISTING_FILES.equipKeysOrder;

// enforceCategories (kok kategoriler, config) + bayi sitesi kategorilerinin OTOMATIK kesfi:
// src/data/listings/<SITE>/<KATEGORI>/ her zaman dogrulanir — site basina config gerekmez.
const categories = [...LISTING_FILES.enforceCategories, ...dealerCategories()];

const isFix = process.argv.includes('--fix');
let hasError = false;
let hasUnfixableError = false;

function formatListing(listing, fileLabel) {
  const newListing = {};
  const carLabel = `${listing.listingId || '?'}/${listing.mobileDeId || '?'}`;

  // 1. Check for extra keys not in our schema
  const extraKeys = Object.keys(listing).filter(k => !ROOT_KEYS_ORDER.includes(k));
  if (extraKeys.length > 0) {
    console.error(`Error: [${carLabel}] ${fileLabel} — unknown root keys: ${extraKeys.join(', ')}`);
    hasError = true;
  }

  // 2. Build the new object strictly in order
  for (const key of ROOT_KEYS_ORDER) {
    if (key === 'equipmentFeatures') {
      const newEquip = {};
      const oldEquip = listing.equipmentFeatures || {};

      const extraEquipKeys = Object.keys(oldEquip).filter(k => !EQUIP_KEYS_ORDER.includes(k));
      if (extraEquipKeys.length > 0) {
        console.error(`Error: [${carLabel}] ${fileLabel} — unknown equipment features: ${extraEquipKeys.join(', ')}`);
        hasError = true;
      }

      for (const eqKey of EQUIP_KEYS_ORDER) {
        newEquip[eqKey] = oldEquip[eqKey] !== undefined ? oldEquip[eqKey] : 'unknown';
      }
      newListing[key] = newEquip;
    } else if (OPTIONAL_KEYS.has(key)) {
      // Bos/yok ise alan HIC yazilmaz — kayitlar null gurultusuyle sismesin.
      const v = listing[key];
      const empty = v === null || v === undefined || v === ''
        || (Array.isArray(v) && v.length === 0)
        || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
      if (!empty) newListing[key] = v;
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
        newListing[key] = ARRAY_KEYS.has(key) ? [] : null;
      }
    }
  }

  return newListing;
}

const seenIds = new Map();
// listingId benzersizligi TUM agac genelinde (C-serisi + site onekli seriler).
// Ayni kategori icinde cakisma dosya adi geregi imkansiz; kategoriler ARASI hala
// mumkun. --fix bile SILMEZ — cakisma tahsis hatasidir, elle cozulmeli.
const seenListingIds = new Map();

for (const category of categories) {
  const absDir = path.join(listingsDir, category);
  if (!fs.existsSync(absDir)) {
    // Bos kategori = olmayan dizin (git bos dizin izlemez) — hata degil.
    console.log(`Check passed for ${category} (bos kategori)`);
    continue;
  }

  const errorsBefore = { hasError, hasUnfixableError };
  for (const fname of fs.readdirSync(absDir).filter(f => f.endsWith('.json')).sort()) {
    const fileLabel = path.join(category, fname);
    const filePath = path.join(absDir, fname);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    let listing;
    try {
      listing = JSON.parse(rawData);
    } catch {
      console.error(`Failed to parse ${fileLabel}`);
      process.exit(1);
    }
    if (!listing || typeof listing !== 'object' || Array.isArray(listing)) {
      console.error(`Error: ${fileLabel} tek arac objesi olmali (array/ilkel bulundu). NOT auto-fixed.`);
      hasError = true;
      hasUnfixableError = true;
      continue;
    }

    const formattedItem = formatListing(listing, fileLabel);
    const lid = formattedItem.listingId;
    const id = formattedItem.mobileDeId;

    if (!lid) {
      console.error(`Error: ${fileLabel} — listingId eksik. NOT auto-fixed — elle cozulmeli.`);
      hasError = true;
      hasUnfixableError = true;
      continue;
    }

    // ID yeniden adlandirmak dosya tasima + referans kaymasi demek; --fix bunu
    // sessizce YAPMAZ (duplicate listingId ile ayni gerekce) — elle cozulur.
    if (!isValidListingId(lid)) {
      console.error(`Error: ${fileLabel} — gecersiz listingId "${lid}" (beklenen desen: ${LISTING_ID_PATTERN}). NOT auto-fixed — elle cozulmeli.`);
      hasError = true;
      hasUnfixableError = true;
      continue;
    }

    if (seenListingIds.has(lid)) {
      console.error(`Error: Duplicate listingId ${lid} found in ${fileLabel} (previously in ${seenListingIds.get(lid)}). NOT auto-fixed — resolve manually.`);
      hasError = true;
      hasUnfixableError = true;
      continue;
    }
    seenListingIds.set(lid, fileLabel);

    if (id) {
      if (seenIds.has(id)) {
        console.error(`Error: Duplicate mobileDeId ${id} found in ${fileLabel} (previously in ${seenIds.get(id)}).`);
        hasError = true;
        if (isFix) {
          // Fix modunda sonradan gorulen kopyanin DOSYASI silinir (ilk goren kazanir).
          fs.rmSync(filePath);
          console.log(`Removed duplicate ${fileLabel}`);
          continue;
        }
      } else {
        seenIds.set(id, fileLabel);
      }
    }

    // Dosya adi sozlesmesi: <listingId>.json — walkCarFiles/carPath buna guvenir.
    const expectedName = `${lid}.json`;
    if (fname !== expectedName) {
      const expectedPath = carPath(category, lid);
      if (fs.existsSync(expectedPath)) {
        console.error(`Error: ${fileLabel} adi ${expectedName} olmali ama o dosya zaten var. NOT auto-fixed — elle cozulmeli.`);
        hasError = true;
        hasUnfixableError = true;
        continue;
      }
      if (isFix) {
        fs.writeFileSync(expectedPath, JSON.stringify(formattedItem, null, 2) + '\n', 'utf-8');
        fs.rmSync(filePath);
        console.log(`Renamed ${fileLabel} -> ${path.join(category, expectedName)}`);
      } else {
        console.error(`Error: ${fileLabel} adi listingId ile eslesmiyor (beklenen: ${expectedName}).`);
        hasError = true;
      }
      continue;
    }

    const newDataStr = JSON.stringify(formattedItem, null, 2) + '\n';
    if (newDataStr !== rawData) {
      if (isFix) {
        fs.writeFileSync(filePath, newDataStr, 'utf-8');
        console.log(`Fixed formatting in ${fileLabel}`);
      } else {
        console.error(`Error: ${fileLabel} does not match strict formatting.`);
        hasError = true;
      }
    }
  }
  if (hasError === errorsBefore.hasError && hasUnfixableError === errorsBefore.hasUnfixableError) {
    console.log(`Check passed for ${category}`);
  }
}

if (hasUnfixableError) {
  console.error('\nUnfixable error found (duplicate listingId / bozuk yapi) — bu --fix ile duzelmez, elle cozulmeli!');
  process.exit(1);
}
if (hasError && !isFix) {
  console.error('\nListings formatting error or duplicates found! Please run "npm run format:data" to fix.');
  process.exit(1);
} else {
  console.log('\nAll listings are strictly formatted and uniquely indexed by mobileDeId!');
}
