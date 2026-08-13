import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RWD } from './drivetrain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const listingsDir = path.resolve(__dirname, '../../src/data/listings');

// Dosya-yönlendirme tabloları veri olarak LISTING_FILES.json'da (config-driven).
const LISTING_FILES = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/data/metadata/LISTING_FILES.json'), 'utf8'));

// SOLD arşivi tahrik + sunroof'a göre ayrık; tek kaynak: parse-car-json / mark-sold / rematch.
export const SOLD_FILES = LISTING_FILES.soldFiles;

export const ALL_SOLD_FILES = Object.values(SOLD_FILES);

const archiveObj = (name) => ({ path: path.join(listingsDir, name), name });

// Bir aracın gitmesi gereken SOLD dosyası: xDrive → tek dosya; RWD → sunroof'a göre
// (S403A==="no" ise WITHOUT, aksi halde — yes/unknown — WITH). Override drivetrain öncelikli.
export function soldArchiveFor(car) {
  const ov = car.overrideFeatures?.drivetrainType;
  const drive = (ov && (ov.value ?? ov)) || car.drivetrainType;
  if (drive !== RWD) return archiveObj(SOLD_FILES.xdrive);
  const noSunroof = car.equipmentFeatures?.S403A === 'no';
  return archiveObj(noSunroof ? SOLD_FILES.rwdNoSunroof : SOLD_FILES.rwdSunroof);
}

export const DEFAULT_SOURCE_FILES = LISTING_FILES.defaultSourceFiles;

// Bayi kayitlari alt klasorde (BMW_NL/COUPE_GAS_WITH_SUNROOF.json). Kok dosya
// listesi bunlari gormedigi icin delist olan bayi ilani (N5/N6) SOLD'a
// tasinamiyordu. Kaynak listesi artik alt klasorleri de kapsar.
export function dealerSourceFiles(dir = listingsDir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const sub of fs.readdirSync(path.join(dir, entry.name))) {
      if (sub.endsWith('.json') && !sub.includes('_SOLD')) out.push(`${entry.name}${path.sep}${sub}`);
    }
  }
  return out;
}

// Bayi kaydinin SOLD hedefi KENDI klasorunde kalir — kok SOLD arsivi mobile.de'ye
// ozeldir (pricingCalculator karsilastirma havuzu oradan beslenir).
export function dealerSoldArchiveFor(sourceFile, car) {
  const dirName = path.dirname(sourceFile);
  if (dirName === '.') return soldArchiveFor(car);
  const base = soldArchiveFor(car).name;                 // ayni tahrik/sunroof kurali
  const name = path.join(dirName, base);
  const full = path.join(listingsDir, name);
  if (!fs.existsSync(full)) fs.writeFileSync(full, '[]\n', 'utf-8');
  return { path: full, name };
}

// mark-kazali.js'in yazdigi audit action'i — INSAN karari isareti.
// KAZALI dosyalari activeFiles'ta oldugu icin parse-car-json.js onlari otomatik
// tasiyabiliyor; Apify metninde hasar kelimesi gecmiyorsa ilan temiz havuza geri
// donuyordu. Manuel isaret varsa otomatik siniflandirma ONU EZEMEZ.
// (CAKAL zaten frozenFiles'ta korunuyor; KAZALI'da bu koruma yoktu.)
export const KAZALI_AUDIT_ACTION = 'Kazalı İşaretlendi';
export const isManuallyMarkedKazali = (car) =>
  (car?.auditHistory || []).some(entry => entry.action === KAZALI_AUDIT_ACTION);

export function pushAudit(car, action, detail) {
  car.auditHistory = car.auditHistory || [];
  car.auditHistory.push({
    action,
    detail: detail ?? null,
    changes: null,
    auditDate: new Date().toISOString()
  });
  car.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));
}

export function moveListing({ id, sourceFiles = DEFAULT_SOURCE_FILES, pickArchive, mutateCar }) {
  if (!id) throw new Error('moveListing called without id');
  const matches = (car) => car.mobileDeId === id || car.listingId === id;

  let foundCar = null;
  let sourceFile = null;
  for (const file of sourceFiles) {
    const filePath = path.join(listingsDir, file);
    if (!fs.existsSync(filePath)) continue;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const index = data.findIndex(matches);
    if (index !== -1) {
      foundCar = data[index];
      sourceFile = file;
      data.splice(index, 1);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      break;
    }
  }

  if (!foundCar) {
    return { found: false };
  }

  const archive = pickArchive(sourceFile, foundCar);
  mutateCar(foundCar, { sourceFile, archive });

  const archiveData = JSON.parse(fs.readFileSync(archive.path, 'utf-8'));
  archiveData.push(foundCar);
  fs.writeFileSync(archive.path, JSON.stringify(archiveData, null, 2) + '\n', 'utf-8');

  return { found: true, car: foundCar, sourceFile, archive };
}
