import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDealerSites, siteConfig, dealerKeyFor, sellerMatches } from './dealer-sites.js';
import { maxListingIdNumber, createIdAllocator } from './listing-id.js';
import { buildExistingIndex, lookupListing } from './existing-index.js';
import { parseRawToListing } from './parse-listing.js';
import { determineTargetFile } from './route-listing.js';

// --- dealer-sites ---

test('dealer-sites — 7 site, benzersiz idPrefix ve site adi', () => {
  const sites = loadDealerSites();
  assert.equal(sites.length, 7);
  assert.equal(new Set(sites.map(s => s.idPrefix)).size, 7, 'idPrefix benzersiz olmali');
  assert.equal(new Set(sites.map(s => s.site)).size, 7);
  // Site adi klasor adi olur — alt cizgi dump-dealer key semasinda ayirac DEGIL
  // ama klasor adinda serbesttir; onek C ile CAKISMAMALI (C-serisi mobile.de'nin).
  for (const s of sites) assert.notEqual(s.idPrefix, 'C', `${s.site} oneki C olamaz`);
});

test('dealer-sites — dealerKeyFor pattern yakalarsa ID, yakalamazsa URL fallback', () => {
  const ahg = siteConfig('AHG');
  assert.equal(dealerKeyFor(ahg, 'https://www.ahg-mobile.de/de/fahrzeugsuche/bmw-m440i-169476'), 'AHG:169476');
  const weller = siteConfig('WELLER'); // pattern null
  assert.equal(dealerKeyFor(weller, 'https://wellergruppe.de/fahrzeug/abc/'), 'WELLER:https://wellergruppe.de/fahrzeug/abc');
  assert.equal(dealerKeyFor(ahg, null), null);
});

// --- listing-id ---

const makeListingsDir = (layout) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'listings-test-'));
  for (const [rel, cars] of Object.entries(layout)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify(cars));
  }
  return dir;
};

test('listing-id — alt klasorler DAHIL max bulunur (C-serisi bug regresyonu)', () => {
  const dir = makeListingsDir({
    'A.json': [{ listingId: 'C5' }, { listingId: 'C12' }],
    'WELLER/B.json': [{ listingId: 'W3' }, { listingId: 'C99' }],
  });
  assert.equal(maxListingIdNumber('C', dir), 99, 'alt klasordeki C99 gorulmeli');
  assert.equal(maxListingIdNumber('W', dir), 3);
  assert.equal(maxListingIdNumber('AHG', dir), 0);
});

test('listing-id — allocator sirali uretir, prefix cakismaz', () => {
  const dir = makeListingsDir({ 'WELLER/X.json': [{ listingId: 'W7' }] });
  const a = createIdAllocator('W', dir);
  assert.equal(a.next(), 'W8');
  assert.equal(a.next(), 'W9');
  // "W" araması "WELLERX" gibi uzun onekleri yakalamamali (regex ^W(\d+)$)
  const dir2 = makeListingsDir({ 'X.json': [{ listingId: 'WELLER123' }] });
  assert.equal(maxListingIdNumber('W', dir2), 0);
});

test('listing-id — walkListingFiles bozuk JSON dosyasini sessiz atlar', () => {
  const dir = makeListingsDir({ 'A.json': [{ listingId: 'C1' }] });
  fs.writeFileSync(path.join(dir, 'BROKEN.json'), '{ bozuk');
  assert.equal(maxListingIdNumber('C', dir), 1);
});

// --- existing-index ---

test('existing-index — mobileDeId / vin / dealerKey ile bulur, oncelik sirali', () => {
  const dir = makeListingsDir({
    'ROOT.json': [{ listingId: 'C1', mobileDeId: '111', vin: 'WBA81AP010CN63825' }],
    'AHG/COUPE_GAS_WITH_SUNROOF.json': [{ listingId: 'A1', mobileDeId: null, dealerListingUrl: 'https://www.ahg-mobile.de/x-555' }],
  });
  const idx = buildExistingIndex(dir);
  assert.equal(lookupListing(idx, { mobileDeId: '111' }).listingId, 'C1');
  assert.equal(lookupListing(idx, { vin: 'wba81ap010cn63825' }).listingId, 'C1', 'VIN case-insensitive');
  assert.equal(lookupListing(idx, { dealerKey: 'AHG:555' }).listingId, 'A1');
  assert.equal(lookupListing(idx, { mobileDeId: '999' }), null);
  // alt klasor dosya yolu site onekiyle raporlanir (import-dealer "kok mu site mi" ayrimi)
  assert.ok(lookupListing(idx, { dealerKey: 'AHG:555' }).file.startsWith('AHG'));
});

// --- parse-listing + route-listing (bayi kaydi uctan uca) ---

const dealerRaw = {
  title: 'BMW M440i xDrive Coupe',
  description: 'Schiebedach elektrisch, Driving Assistant Professional, Laserlicht',
  features: ['Sunroof', 'Four-wheel drive'],
  properties: { milage: '30.000 km', firstRegistration: '10/2023', upholstery: 'Full leather, Black', colour: 'Grey', manufacturerColour: 'DRAVITGRAU', fuelType: 'Petrol' },
  price: { amount: 55000 },
  dealer: { name: 'Test Bayi', contry: 'DE', addesses: ['Teststr. 1', 'DE-12345 Teststadt'] },
  vin: 'WBA11AR010CN00001',
  dealerListingUrl: 'https://example.de/fzg-42',
};

test('parse-listing — bayi kaydi: vin/dealerListingUrl korunur, source audit etiketine islenir', () => {
  const car = parseRawToListing({ ...dealerRaw, createdTime: '2026-08-01T00:00:00.000Z' }, { listingId: 'W1', source: 'WELLER' });
  assert.equal(car.listingId, 'W1');
  assert.equal(car.vin, 'WBA11AR010CN00001');
  assert.equal(car.dealerListingUrl, 'https://example.de/fzg-42');
  assert.equal(car.listingUrl, 'https://example.de/fzg-42', 'url yoksa dealerListingUrl listingUrl olur');
  assert.equal(car.mobileDeId, null);
  assert.ok(car.auditHistory.some(a => a.action === 'İlan Yayınlandı (WELLER)'));
  // VIN 11AR = xDrive (Kural 0)
  assert.equal(car.drivetrainType, 'xDrive AWD');
  assert.match(car.drivetrainReason, /Kural 0/);
});

test('parse-listing — opts.vin fallback (mevcut listing VIN tasir, raw tasimaz)', () => {
  const { vin: _drop, ...rawNoVin } = dealerRaw;
  const car = parseRawToListing(rawNoVin, { listingId: 'C692', vin: 'WBA81AP010CN63825' });
  assert.equal(car.vin, 'WBA81AP010CN63825');
  assert.equal(car.drivetrainType, 'RWD', 'listing VIN Kural 0 tetiklemeli');
});

test('route-listing — bayi coupe sunroof dogru dosyaya gider', () => {
  const car = parseRawToListing(dealerRaw, { listingId: 'W1', source: 'WELLER' });
  const { target } = determineTargetFile(car, dealerRaw);
  assert.equal(target, 'COUPE_GAS_WITH_SUNROOF');
});

test('route-listing — LT bayi araci ulke-dislamaya takilir', () => {
  const raw = { ...dealerRaw, dealer: { ...dealerRaw.dealer, contry: 'LT' } };
  const car = parseRawToListing(raw, { listingId: 'W2', source: 'WELLER' });
  const { target, reason } = determineTargetFile(car, raw);
  assert.equal(target, 'LITHUANIA');
  assert.match(reason, /LT/);
});

// --- sellerMatches (ayni-satici birlestirme kurali) ---
// W1≈C264 vakasi: "WELLER Hildesheim" (bayi sitesi) = "WELLER Premium GmbH ★4.7" (mobile.de).
// Twin + satici eslesmesi -> yeni kayit acilmaz, mobile.de kaydina dealerListingUrl baglanir.

test('sellerMatches — ayni bayi farkli yazimlar', () => {
  assert.equal(sellerMatches('WELLER Hildesheim', 'WELLER Premium GmbH ★4.7'), true);
  assert.equal(sellerMatches('ahg Autohandelsgesellschaft mbH', 'ahg Autohandelsgesellschaft mbH ★4.9'), true);
});

test('sellerMatches — farkli bayiler eslesmez', () => {
  assert.equal(sellerMatches('WELLER Hildesheim', 'Autohaus Siegerland'), false);
  assert.equal(sellerMatches('Euler Group', 'Timmermanns GmbH'), false);
});

test('sellerMatches — jenerik kelimeler tek basina eslesme SAYILMAZ', () => {
  assert.equal(sellerMatches('Autohaus Premium GmbH', 'Premium Auto Group'), false);
  assert.equal(sellerMatches('', 'WELLER'), false);
  assert.equal(sellerMatches(null, undefined), false);
});

test('sellerMatches — kisa bayi kisaltmasi (ahg) eslesir, "BMW" tek basina eslesTIRMEZ', () => {
  assert.equal(sellerMatches('BMW Freiburg (ahg)', 'ahg Autohandelsgesellschaft mbH ★4.7'), true);
  assert.equal(sellerMatches('BMW Freiburg', 'BMW München'), false);
});

// --- mergeTwinIntoRoot: zit celiski kaydi ---
test('mergeTwinIntoRoot — unknown cozulur, zit celiski VERI DEGISTIRMEDEN kaydedilir', async () => {
  const { mergeTwinIntoRoot } = await import('./merge-twin.js');
  const root = { equipmentFeatures: { S403A: 'yes', S610A: 'unknown', S688A: 'no' }, listingDescriptionNotes: [] };
  const ch = mergeTwinIntoRoot(root, { dealerListingUrl: 'https://x.de/1', vin: null,
    freshEquipment: { S403A: 'no', S610A: 'yes', S688A: 'no' }, source: 'WELLER' });
  assert.equal(root.equipmentFeatures.S610A, 'yes', 'unknown cozuldu');
  assert.equal(root.equipmentFeatures.S403A, 'yes', 'zit celiskide veri EZILMEDI');
  assert.deepEqual(root.equipmentConflicts, { S403A: { 'mobile.de': 'yes', WELLER: 'no' } }, 'yapisal celiski kaydi');
  assert.ok(ch.equipmentConflicts, 'audit degisikligi');
  // celiski cozulunce alan kalkmali
  (await import('./merge-twin.js')).mergeTwinIntoRoot(root, { freshEquipment: { S403A: 'yes' }, source: 'WELLER' });
  assert.equal(root.equipmentConflicts, undefined, 'hemfikir olununca celiski silinir');
});

test('mergeTwinIntoRoot — iki kaynagin celiskileri BIRIKIR, biri digerini ezmez', async () => {
  const { mergeTwinIntoRoot } = await import('./merge-twin.js');
  const root = { equipmentFeatures: { S403A: 'yes', KGNL: 'no' }, listingDescriptionNotes: [] };
  mergeTwinIntoRoot(root, { freshEquipment: { S403A: 'no' }, source: 'WELLER' });
  mergeTwinIntoRoot(root, { freshEquipment: { KGNL: 'yes' }, source: 'BMW_DE' });
  assert.deepEqual(root.equipmentConflicts, {
    S403A: { 'mobile.de': 'yes', WELLER: 'no' },
    KGNL: { 'mobile.de': 'no', BMW_DE: 'yes' },
  }, 'C264 vakasi: BMW_DE senkronu WELLER celiskisini ezmemeli');
  // WELLER artik hemfikir olursa yalniz KENDI girdisi silinir
  mergeTwinIntoRoot(root, { freshEquipment: { S403A: 'yes' }, source: 'WELLER' });
  assert.deepEqual(root.equipmentConflicts, { KGNL: { 'mobile.de': 'no', BMW_DE: 'yes' } });
});
