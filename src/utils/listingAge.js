// İlan yaşı hesabı — SAF fonksiyonlar, veri/JSON bağımlılığı YOK (node --test ile
// doğrudan koşulur). Tek kaynak: skor cezası, öneri rozeti ve tablo aynı sayıyı üretir.
//
// Gerçek ilan yaşı için "ilk yayın" tarihi — re-list'e dayanıklı.
// Bayi ilanı kapatıp aynı aracı yeni ID ile açınca (C729/C1145 vakası) mobile.de
// createdTime SIFIRLANIR; kaydın audit'indeki ilk "İlan Yayınlandı/İlan Eklendi"
// girdisi eski tarihi korur. İkisinin MİNİMUMU alınır → yaş sıfırlama işe yaramaz.
// Normal kayıtta audit tarihi createdTime'dan sonra olduğu için sonuç değişmez.
const PUBLISH_ACTIONS = ['İlan Yayınlandı', 'İlan Eklendi'];
export const listingCreatedAt = (car) => {
  const stamps = [
    car?.listingDates?.createdTime,
    ...(car?.auditHistory || []).filter(h => PUBLISH_ACTIONS.some(a => h.action?.includes(a))).map(h => h.auditDate),
  ].map(d => d ? new Date(d).getTime() : NaN).filter(t => !Number.isNaN(t));
  return stamps.length ? new Date(Math.min(...stamps)).toISOString() : null;
};

// Satış tarihi — yaş sayacı burada DURUR. Satılmış ilan "hâlâ yayında bekliyor"
// değildir; sayaç bugüne kadar işlerse (C45 vakası: 10 günde satıldı ama skorda
// 181 gün yazıyordu) arşiv araçları anlamsızca tavan cezası yer.
const SOLD_ACTIONS = ['SATILDI', 'İlan Satıldı'];
export const listingSoldAt = (car) => {
  const stamps = (car?.auditHistory || [])
    .filter(h => SOLD_ACTIONS.some(a => h.action?.includes(a)))
    .map(h => new Date(h.auditDate).getTime())
    .filter(t => !Number.isNaN(t));
  return stamps.length ? new Date(Math.min(...stamps)).toISOString() : null;
};

// Gün farkı: yayından (endTime ?? bugün)'e. Satılmışta endTime = satış tarihi →
// sonuç "kaç günde satıldı", aktifte "kaç gündür yayında".
export const listingAgeInDays = (createdTime, endTime = null) => {
  if (!createdTime) return null;
  const t = new Date(createdTime).getTime();
  if (Number.isNaN(t)) return null;
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  return Math.max(0, Math.floor(((Number.isNaN(end) ? Date.now() : end) - t) / 86400000));
};

// Bir aracın yaşı — TEK kaynak: hem skorlama hem tablo/rozet bunu kullanır.
export const carListingAgeDays = (car) => listingAgeInDays(listingCreatedAt(car), listingSoldAt(car));
