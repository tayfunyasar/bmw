// src/data/listings agacinin TEK erisim katmani (arac-basina-dosya yerlesimi).
//
// Yerlesim: <listingsDir>/<KATEGORI>/<listingId>.json          (kok, mobile.de)
//           <listingsDir>/<SITE>/<KATEGORI>/<listingId>.json   (bayi)
// Dosya = TEK arac objesi. Kategori kimligi her yerde relative dizin stringi:
// 'CABRIO' veya 'WELLER/CABRIO' — eski merged-dosya donemindeki hit.file
// degerleriyle birebir ayni, cagiran kodlar bu sozlesmeye guvenir.
//
// Kok/bayi ayrimi config-driven: DEALER_SITES.json'daki site adlari. ("Her alt
// dizin = bayi" kurali per-car yapida gecersiz — artik her kategori bir dizin.)
//
// Bos kategori = olmayan dizin (git bos dizin izlemez): okuma [] doner,
// yazma mkdir -p yapar, son dosyasi silinen dizin rmdir'lenir.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDealerSites } from './dealer-sites.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const listingsDir = path.resolve(__dirname, '../../src/data/listings');

// Kategori listeleri + sema + yonlendirme tablolari — TEK kaynak, TEK parse.
// Script'ler JSON'u kendisi okumaz, buradan import eder.
export const LISTING_FILES = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../src/data/metadata/LISTING_FILES.json'), 'utf8')
);

export function dealerSiteNames() {
  return loadDealerSites().map(s => s.site);
}

const subdirsOf = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)
  : [];

export function rootCategories(dir = listingsDir) {
  const sites = new Set(dealerSiteNames());
  return subdirsOf(dir).filter(name => !sites.has(name)).sort();
}

export function dealerCategories(dir = listingsDir) {
  const sites = new Set(dealerSiteNames());
  const out = [];
  for (const site of subdirsOf(dir)) {
    if (!sites.has(site)) continue;
    for (const sub of subdirsOf(path.join(dir, site))) out.push(site + path.sep + sub);
  }
  return out.sort();
}

export function allCategories(dir = listingsDir) {
  return [...rootCategories(dir), ...dealerCategories(dir)];
}

export function categoryDir(category, dir = listingsDir) {
  return path.join(dir, category);
}

export function carPath(category, listingId, dir = listingsDir) {
  return path.join(dir, category, `${listingId}.json`);
}

// Kategori array'e cevrilirken sira: listingId sayisal soneki artan (C9 < C40).
// Eski merged dosyalardaki insertion-order'in yerini alir; UI kendi siralamasini
// yaptigi icin tek gereksinim deterministik olmasi.
const idNum = (listingId) => {
  const m = String(listingId ?? '').match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
};
export const compareByListingId = (a, b) =>
  idNum(a.listingId) - idNum(b.listingId) || String(a.listingId).localeCompare(String(b.listingId));

const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};
const isCarObject = (data) => !!data && typeof data === 'object' && !Array.isArray(data);

const carFilesIn = (absDir) => fs.existsSync(absDir)
  ? fs.readdirSync(absDir).filter(f => f.endsWith('.json')).sort()
  : [];

export function readCategory(category, dir = listingsDir) {
  const absDir = categoryDir(category, dir);
  const cars = [];
  for (const f of carFilesIn(absDir)) {
    const data = readJson(path.join(absDir, f));
    if (isCarObject(data)) cars.push(data);
  }
  return cars.sort(compareByListingId);
}

export function readCar(category, listingId, dir = listingsDir) {
  const data = readJson(carPath(category, listingId, dir));
  return isCarObject(data) ? data : null;
}

const serialize = (car) => JSON.stringify(car, null, 2) + '\n';

// Byte-esitse dokunmaz (idempotent, mtime/git gurultusu yok).
export function writeCar(category, car, dir = listingsDir) {
  if (!car?.listingId) throw new Error(`writeCar: listingId olmayan kayit yazilamaz (${category})`);
  const file = carPath(category, car.listingId, dir);
  const next = serialize(car);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === next) return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next, 'utf8');
  return file;
}

const pruneEmptyDirs = (absDir, stopAt) => {
  let current = absDir;
  while (current !== stopAt && fs.existsSync(current) && fs.readdirSync(current).length === 0) {
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
};

export function removeCar(category, listingId, dir = listingsDir) {
  const file = carPath(category, listingId, dir);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file);
  pruneEmptyDirs(path.dirname(file), dir);
  return true;
}

// "Array'i bellekte tut, sonda topluca yaz" deseninin karsiligi: listedeki her
// arac yazilir, listede OLMAYAN listingId dosyalari silinir (splice = dosya silme).
export function writeCategory(category, cars, dir = listingsDir) {
  for (const car of cars) writeCar(category, car, dir);
  const keep = new Set(cars.map(c => `${c.listingId}.json`));
  const absDir = categoryDir(category, dir);
  for (const f of carFilesIn(absDir)) {
    if (!keep.has(f)) fs.rmSync(path.join(absDir, f));
  }
  pruneEmptyDirs(absDir, dir);
}

// Once hedefe yaz SONRA kaynagi sil — yarida kesilirse veri kaybi degil
// duplicate listingId olusur, lint yakalar.
export function moveCar(fromCategory, toCategory, car, dir = listingsDir) {
  writeCar(toCategory, car, dir);
  removeCar(fromCategory, car.listingId, dir);
}

// Tum agac: [{ category, listingId, file }] — listingId dosya adindan gelir
// (lint filename==listingId garantiler), dosya icerigi PARSE EDILMEZ.
export function walkCarFiles(dir = listingsDir) {
  const out = [];
  for (const category of allCategories(dir)) {
    const absDir = categoryDir(category, dir);
    for (const f of carFilesIn(absDir)) {
      out.push({ category, listingId: f.replace(/\.json$/, ''), file: path.join(absDir, f) });
    }
  }
  return out;
}

// mobileDeId VEYA listingId ile ilk eslesen arac. Kategori sirasi = arama onceligi.
export function findCar(id, categories, dir = listingsDir) {
  const wanted = String(id);
  for (const category of categories) {
    for (const car of readCategory(category, dir)) {
      if ((car.mobileDeId != null && String(car.mobileDeId) === wanted) || car.listingId === wanted) {
        return { car, category, file: carPath(category, car.listingId, dir) };
      }
    }
  }
  return null;
}
