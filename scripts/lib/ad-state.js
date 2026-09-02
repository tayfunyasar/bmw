// Bir mobile.de ilaninin PIYASA durumu: 'alive' | 'dead' | 'unknown'.
//
// Tek kaynak: dumps.js readLiveDump. Orada IKI AYRI sinyal doner ve karistirilmamali:
//   raw          → ICERIK (en yeni CANLI dump; olu dump'in ardindaki eski dolu dump da olabilir)
//   newestIsDead → PIYASA DURUMU (en yeni dump "Listing does not exists anymore" mi?)
//
// C853/C1153 vakasi (2026-09-01): merge-relists yalniz `raw`'a baktigi icin, en yeni dump'i
// OLU olan ama eski dolu dump'i bulunan ikiz "alive" sayildi ve re-list birlestirmesi
// sessizce reddedildi. Piyasa karari BURADAN verilir; icerik icin raw'a bakilir.
import { readLiveDump } from './dumps.js';

export function adState(mobileDeId, dumpIndex, dir) {
  if (!mobileDeId) return 'unknown';
  const { raw, reason, newestIsDead } = readLiveDump(mobileDeId, dumpIndex, dir);
  if (newestIsDead || reason === 'deadDump') return 'dead';
  return raw ? 'alive' : 'unknown';
}
