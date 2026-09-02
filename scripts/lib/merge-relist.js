// Re-list birlestirmesinin SAF cekirdegi (dosya I/O yok) — merge-relists.js buradan cagirir.
//
// Yon: ESKI kayit (root) kok kalir; yeni ilanin mobileDeId/listingUrl/listingDates koke
// tasinir. Yeni kaydin audit gecmisi SILINMEZ — koke eklenir ve tarihe gore siralanir
// (C235/C266 vakasi, 2026-09-01: 3.5 aylik fiyat/km gecmisi silinmisti). Ilk yayin
// tarihi kokte kaldigi icin yas hesabi (src/utils/listingAge.js) etkilenmez.
//
// Icerik (fiyat/km/donanim) burada dokunulmaz — birlestirmeden sonra yeni mobileDeId'nin
// dump'iyla `node scripts/parse-car-json.js <yeniId>` calistirilarak esitlenir.
export const RELIST_ACTION = 'Yeniden İlan (Re-list)';

const byDate = (a, b) => new Date(a.auditDate).getTime() - new Date(b.auditDate).getTime();

export function mergeRelistIntoRoot(root, newCar, nowIso = new Date().toISOString()) {
  const changes = {
    mobileDeId: { old: root.mobileDeId, new: newCar.mobileDeId },
    listingUrl: { old: root.listingUrl, new: newCar.listingUrl },
  };
  root.mobileDeId = newCar.mobileDeId;
  root.listingUrl = newCar.listingUrl;
  root.listingDates = newCar.listingDates;      // ham veri: kayit artik YENI ilana bakiyor
  root.possibleTwinOf = null;
  root.auditHistory = [...(root.auditHistory || []), ...(newCar.auditHistory || [])].sort(byDate);
  root.auditHistory.push({
    action: RELIST_ACTION,
    detail: `Aynı araç bayi tarafından yeni ilan olarak açıldı; ${newCar.listingId} kaydı bu köke birleştirildi (satıcı aynı, eski ilan mobile.de'den kalkmış). ${newCar.listingId}'in audit geçmişi korundu; gerçek ilan yaşı audit'teki ilk yayın tarihinden hesaplanır.`,
    changes,
    auditDate: nowIso,
  });
  return { root, changes };
}
