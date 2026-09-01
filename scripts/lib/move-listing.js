import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RWD } from './drivetrain.js';
import { listingsDir, dealerCategories, findCar, moveCar } from './listings-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export { listingsDir };

// Dosya-yönlendirme tabloları veri olarak LISTING_FILES.json'da (config-driven).
const LISTING_FILES = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/data/metadata/LISTING_FILES.json'), 'utf8'));

// SOLD arşivi tahrik + sunroof'a göre ayrık; tek kaynak: parse-car-json / mark-sold / rematch.
export const SOLD_CATEGORIES = LISTING_FILES.soldCategories;

export const ALL_SOLD_CATEGORIES = Object.values(SOLD_CATEGORIES);

// Bir aracın gitmesi gereken SOLD kategorisi: xDrive → tek kategori; RWD → sunroof'a göre
// (S403A==="no" ise WITHOUT, aksi halde — yes/unknown — WITH). Override drivetrain öncelikli.
export function soldArchiveFor(car) {
  const ov = car.overrideFeatures?.drivetrainType;
  const drive = (ov && (ov.value ?? ov)) || car.drivetrainType;
  if (drive !== RWD) return SOLD_CATEGORIES.xdrive;
  const noSunroof = car.equipmentFeatures?.S403A === 'no';
  return noSunroof ? SOLD_CATEGORIES.rwdNoSunroof : SOLD_CATEGORIES.rwdSunroof;
}

export const DEFAULT_SOURCE_CATEGORIES = LISTING_FILES.defaultSourceCategories;

// Bayi kayitlari site alt klasorunde (BMW_NL/COUPE_GAS_WITH_SUNROOF/). Kok kategori
// listesi bunlari gormedigi icin delist olan bayi ilani (N5/N6) SOLD'a
// tasinamiyordu. Kaynak listesi alt klasorleri de kapsar (_SOLD haric).
export function dealerSourceCategories(dir = listingsDir) {
  return dealerCategories(dir).filter(c => !c.includes('_SOLD'));
}

// Satis arsivi secimi:
//   - Yalnizca TEMIZ COUPE kaynaklari tahrik/sunroof kuralina (soldArchiveFor) gider —
//     pricingCalculator'in satilmis fiyat karsilastirma havuzu bunlardan beslenir.
//   - Diger her kaynak (KAZALI'lar, CABRIO, GRAN_COUPE...) KENDI arsivine gider
//     (X → X_SOLD): kazali fiyati da farkli govde tipi de temiz havuzu kirletmez.
//   - Bayi kaydinin SOLD hedefi KENDI site klasorunde kalir — kok SOLD arsivi
//     mobile.de'ye ozeldir.
export function dealerSoldArchiveFor(sourceCategory, car) {
  const site = path.dirname(sourceCategory);
  const base = path.basename(sourceCategory);
  const cleanCoupe = base.startsWith('COUPE_') && !base.includes('KAZALI');
  const archive = cleanCoupe ? soldArchiveFor(car) : `${base}_SOLD`;
  return site === '.' ? archive : path.join(site, archive);
}

// mark-kazali.js'in yazdigi audit action'i — INSAN karari isareti.
// KAZALI kategorileri aktif oldugu icin parse-car-json.js onlari otomatik
// tasiyabiliyor; Apify metninde hasar kelimesi gecmiyorsa ilan temiz havuza geri
// donuyordu. Manuel isaret varsa otomatik siniflandirma ONU EZEMEZ.
// (CAKAL zaten frozen kategoride korunuyor; KAZALI'da bu koruma yoktu.)
export const KAZALI_AUDIT_ACTION = 'Kazalı İşaretlendi';
export const isManuallyMarkedKazali = (car) =>
  (car?.auditHistory || []).some(entry => entry.action === KAZALI_AUDIT_ACTION);

// Kaynak kategoriye gore KAZALI arsivi — tablo config'te (kazaliArchives).
// TEK KAYNAK: hem mark-kazali.js (manuel) hem import-dealer.js (bayi beyani) bunu kullanir.
export function kazaliArchiveFor(sourceCategory) {
  return LISTING_FILES.kazaliArchives[sourceCategory] || LISTING_FILES.kazaliArchives.default;
}

export function pushAudit(car, action, detail, changes = null) {
  car.auditHistory = car.auditHistory || [];
  car.auditHistory.push({
    action,
    detail: detail ?? null,
    changes,
    auditDate: new Date().toISOString()
  });
  car.auditHistory.sort((a, b) => new Date(a.auditDate) - new Date(b.auditDate));
}

// pickArchive(sourceCategory, car) DUZ kategori stringi doner ('COUPE_GAS_WITH_SUNROOF_SOLD'
// veya 'WELLER/COUPE_GAS_WITH_SUNROOF_SOLD'). Tasima = dosya tasima (moveCar).
export function moveListing({ id, sourceCategories = DEFAULT_SOURCE_CATEGORIES, pickArchive, mutateCar }) {
  if (!id) throw new Error('moveListing called without id');

  const hit = findCar(id, sourceCategories);
  if (!hit) return { found: false };

  const { car, category } = hit;
  const archive = pickArchive(category, car);
  mutateCar(car, { sourceCategory: category, archive });
  moveCar(category, archive, car);

  return { found: true, car, sourceCategory: category, archive };
}
