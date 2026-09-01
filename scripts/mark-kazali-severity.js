// KAZALI bir aracin hasar boyutunu isaretler — UI gorunurlugunu belirler.
//   ufak  (minor) → arac ana havuzda 💥 rozetiyle GORUNUR (alan yoksa da varsayilan bu)
//   buyuk (major) → arac ana havuzdan GIZLENIR (yalnizca "kazalilari goster" kapali/acik
//                   farketmez; major daima gizli)
// Dosya TASINMAZ — arac KAZALI kategorisinde kalir, yalnizca kazaliSeverity alani yazilir.
//
// Kullanim:
//   npm run kazali:severity -- <mobileDeId | listingId> <ufak|buyuk> [neden]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findCar, writeCar } from './lib/listings-store.js';
import { pushAudit } from './lib/move-listing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LISTING_FILES = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../src/data/metadata/LISTING_FILES.json'), 'utf8')
);

const LEVELS = { ufak: 'minor', minor: 'minor', buyuk: 'major', büyük: 'major', major: 'major' };

const [id, levelArg, ...reasonParts] = process.argv.slice(2);
const severity = LEVELS[(levelArg || '').toLowerCase()];
if (!id || !severity) {
  console.error('Kullanım: npm run kazali:severity -- <mobileDeId | listingId> <ufak|buyuk> [neden]');
  process.exit(1);
}
const reason = reasonParts.join(' ').trim() || 'Kullanıcı kararı';

// Yalnizca KAZALI kategorilerinde aranir — temiz havuzdaki araca hasar boyutu yazilmaz.
const KAZALI_CATEGORIES = LISTING_FILES.allCategories.filter(c => c.includes('KAZALI'));
const hit = findCar(id, KAZALI_CATEGORIES);
if (!hit) {
  console.error(`Hata: "${id}" hiçbir KAZALI kategorisinde bulunamadı.`);
  process.exit(1);
}

const { car, category } = hit;
const before = car.kazaliSeverity ?? null;
if (before === severity) {
  console.log(`ℹ️  ${car.listingId} zaten ${severity} işaretli — değişiklik yok.`);
  process.exit(0);
}

car.kazaliSeverity = severity;
pushAudit(car, 'Hasar Boyutu İşaretlendi',
  `${severity === 'major' ? 'BÜYÜK kazalı — UI havuzundan gizlenir' : 'UFAK kazalı — UI havuzunda görünür'} — ${reason}`,
  { kazaliSeverity: { old: before, new: severity } });
writeCar(category, car);

console.log(`💥 ${car.listingId} (${car.mobileDeId}) hasar boyutu: ${severity} — ${category} (${reason})`);
