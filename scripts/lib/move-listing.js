import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RWD } from './drivetrain.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const listingsDir = path.resolve(__dirname, '../../src/data/listings');

// SOLD arşivi artık tahrik + sunroof'a göre ayrık (aktif dosya yapısıyla simetri).
// Tek kaynak: parse-car-json / mark-sold / rematch-drivetrain hepsi buradan seçer.
export const SOLD_FILES = {
  xdrive:       'COUPE_GAS_WITH_SUNROOF_SOLD.json',
  rwdSunroof:   'COUPE_GAS_RWD_WITH_SUNROOF_SOLD.json',
  rwdNoSunroof: 'COUPE_GAS_RWD_WITHOUT_SUNROOF_SOLD.json',
};

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

export const DEFAULT_SOURCE_FILES = [
  'COUPE_GAS_WITH_SUNROOF.json',
  'COUPE_GAS_WITHOUT_SUNROOF.json',
  'COUPE_DIESEL_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITH_SUNROOF.json',
  'COUPE_GAS_RWD_WITHOUT_SUNROOF.json',
  'GRAN_COUPE.json'
];

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
