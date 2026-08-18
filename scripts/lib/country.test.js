import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countryCodeFromLocation } from './country.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readMeta = (name) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../src/data/metadata/${name}`), 'utf8'));
const LISTING_FILES = readMeta('LISTING_FILES.json');
const COUNTRY_FLAGS = readMeta('COUNTRY_FLAGS.json');

// --- countryCodeFromLocation ---

test('countryCodeFromLocation — bayrak onekinden ulke kodu', () => {
  assert.equal(countryCodeFromLocation('🇱🇹 LT-50300 Kaunas'), 'LT');
  assert.equal(countryCodeFromLocation('🇳🇱 NL-3281AL Numansdorp'), 'NL');
  assert.equal(countryCodeFromLocation('🇩🇪 DE-73730 Esslingen am Neckar'), 'DE');
});

test('countryCodeFromLocation — fallback bayragi ulke sayilmaz', () => {
  // 🇪🇺 katalogda olmayan ulkeler icin kullaniliyor (or. HU) — kod uretmemeli.
  assert.equal(countryCodeFromLocation('🇪🇺 HU-1138 Budapest'), null);
});

test('countryCodeFromLocation — bos/eksik/bayraksiz girdi', () => {
  assert.equal(countryCodeFromLocation(''), null);
  assert.equal(countryCodeFromLocation(null), null);
  assert.equal(countryCodeFromLocation(undefined), null);
  assert.equal(countryCodeFromLocation('DE-73730 Esslingen'), null);
});

test('countryCodeFromLocation — src/data/countries.js ile ayni ters tabloyu uretir', () => {
  // Iki modul ayni COUNTRY_FLAGS.json'u okur; her ulke kodu kendi bayragindan
  // geri cozulebilmeli (drift olursa bu test kirilir).
  for (const [code, flag] of Object.entries(COUNTRY_FLAGS)) {
    if (code === 'fallback') continue;
    assert.equal(countryCodeFromLocation(`${flag} ${code}-12345 Sehir`), code, `${code} geri cozulmeli`);
  }
});

// --- countryExcludedCategories config butunlugu ---

test('countryExcludedCategories — LT dislanmis ve LITHUANIA hedefi', () => {
  assert.equal(LISTING_FILES.countryExcludedCategories.LT, 'LITHUANIA');
});

test('countryExcludedCategories — her hedef kategori allCategories + enforceCategories icinde olmali', () => {
  // allCategories disinda kalirsa rematch script'leri o kategoriyi hic islemez;
  // enforceCategories disinda kalirsa format/sema dogrulamasi atlanir.
  for (const target of Object.values(LISTING_FILES.countryExcludedCategories)) {
    assert.ok(LISTING_FILES.allCategories.includes(target), `${target} allCategories icinde`);
    assert.ok(LISTING_FILES.enforceCategories.includes(target), `${target} enforceCategories icinde`);
  }
});

test('countryExcludedCategories — hedef kategori otomatik SATILDI kaynagi OLMAMALI', () => {
  // Aksi halde kalkan bir LT ilani SOLD arsivine tasinir ve arayuzde gorunur.
  for (const target of Object.values(LISTING_FILES.countryExcludedCategories)) {
    assert.ok(!LISTING_FILES.autoSoldSourceCategories.includes(target), `${target} autoSold disinda`);
  }
});

test('countryExcludedCategories — hedef kategori elle move:* kaynagi da OLMAMALI', () => {
  // defaultSourceCategories mark-sold/mark-kazali/mark-cakal'in taradigi liste; dislanan
  // ulke kategorisi orada olmamali ki ilan yanlislikla gorunur kategorilere geri donmesin.
  for (const target of Object.values(LISTING_FILES.countryExcludedCategories)) {
    assert.ok(!LISTING_FILES.defaultSourceCategories.includes(target), `${target} defaultSourceCategories disinda`);
  }
});

// --- UI sizintisi ---

test('dislanan ulke kategorisi src/data/index.js glob filtresinden gecmemeli', () => {
  // index.js tum kategorileri glob ile toplar; koruma countryExcludedCategories
  // filtresidir. Filtre mekanizmasi mevcut olmali ve dislanan kategori adi
  // koda literal yazilmamali (config tek kaynak kalsin).
  const indexSource = fs.readFileSync(path.resolve(__dirname, '../../src/data/index.js'), 'utf8');
  assert.ok(indexSource.includes('countryExcludedCategories'), 'index.js dislama filtresini config\'ten okumali');
  for (const target of Object.values(LISTING_FILES.countryExcludedCategories)) {
    assert.ok(!indexSource.includes(target), `${target} index.js'e literal yazilmamali`);
  }
});
