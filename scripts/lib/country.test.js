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

// --- countryExcludedFiles config butunlugu ---

test('countryExcludedFiles — LT dislanmis ve LITHUANIA.json hedefi', () => {
  assert.equal(LISTING_FILES.countryExcludedFiles.LT, 'LITHUANIA.json');
});

test('countryExcludedFiles — her hedef dosya allFiles + enforceFiles icinde olmali', () => {
  // allFiles disinda kalirsa rematch script'leri o dosyayi hic islemez;
  // enforceFiles disinda kalirsa format/sema dogrulamasi atlanir.
  for (const target of Object.values(LISTING_FILES.countryExcludedFiles)) {
    assert.ok(LISTING_FILES.allFiles.includes(target), `${target} allFiles icinde`);
    assert.ok(LISTING_FILES.enforceFiles.includes(target), `${target} enforceFiles icinde`);
  }
});

test('countryExcludedFiles — hedef dosya otomatik SATILDI kaynagi OLMAMALI', () => {
  // Aksi halde kalkan bir LT ilani SOLD arsivine tasinir ve arayuzde gorunur.
  for (const target of Object.values(LISTING_FILES.countryExcludedFiles)) {
    assert.ok(!LISTING_FILES.autoSoldSourceFiles.includes(target), `${target} autoSold disinda`);
  }
});

test('countryExcludedFiles — hedef dosya elle move:* kaynagi da OLMAMALI', () => {
  // defaultSourceFiles mark-sold/mark-kazali/mark-cakal'in taradigi liste; dislanan
  // ulke dosyasi orada olmamali ki ilan yanlislikla gorunur dosyalara geri donmesin.
  for (const target of Object.values(LISTING_FILES.countryExcludedFiles)) {
    assert.ok(!LISTING_FILES.defaultSourceFiles.includes(target), `${target} defaultSourceFiles disinda`);
  }
});

// --- UI sizintisi ---

test('dislanan ulke dosyasi src/data/index.js tarafindan IMPORT EDILMEMELI', () => {
  // Tek gercek koruma bu: UI havuzlari yalnizca index.js'in import ettigi dosyalardan
  // beslenir. Dosya oraya eklenirse LT araclari arayuzde gorunur.
  const indexSource = fs.readFileSync(path.resolve(__dirname, '../../src/data/index.js'), 'utf8');
  for (const target of Object.values(LISTING_FILES.countryExcludedFiles)) {
    assert.ok(!indexSource.includes(target), `${target} index.js'te import EDILMEMELI`);
  }
});
