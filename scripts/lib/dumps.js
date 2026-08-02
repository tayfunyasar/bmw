// dump/ klasorundeki ham Apify ciktilarini cozumler.
//
// Tek kaynak: rematch-equipment.js ve rematch-drivetrain.js bu modulu kullanir —
// dump secme mantigi asla kopyalanmaz. (Eskiden iki script'te birebir ayni
// buildLatestDumps kopyasi vardi; ikisi de asagidaki "olu dump" hatasini tasiyordu.)
//
// Dosya adi semasi: dump/<mobileDeId>_<timestamp>.json
//
// KRITIK: bir ilan mobile.de'den kalktiginda Apify `title: "Listing does not exists
// anymore"` iceren BOS bir kayit dondurur ve bu kayit da dump'a yazilir. En yeni dump
// bu oldugunda ilan "yeniden turetilemez" gibi gorunur — oysa AYNI ID icin daha eski,
// icerik dolu bir dump durur. Bu yuzden "en yeni" degil, "en yeni CANLI" dump secilir.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const dumpDir = path.resolve(__dirname, '../../dump');

// Apify'in "ilan kalkmis" cevabi — icerik tasimaz, donanim/tahrik turetilemez.
export const DEAD_DUMP_TITLE = 'Listing does not exists anymore';
export const isDeadDump = (raw) => !raw || raw.title === DEAD_DUMP_TITLE;

// mobileDeId → tum dump dosyalari, en yeniden en eskiye sirali.
export function buildDumpIndex(dir = dumpDir) {
  const index = {};
  for (const filename of fs.readdirSync(dir)) {
    if (!filename.endsWith('.json')) continue;
    const [id, tsRaw] = filename.replace(/\.json$/, '').split('_');
    if (!id) continue;
    (index[id] = index[id] || []).push({ ts: parseInt(tsRaw) || 0, filename });
  }
  for (const list of Object.values(index)) list.sort((a, b) => b.ts - a.ts);
  return index;
}

// Bir ilan icin kullanilabilir en yeni CANLI dump'i okur.
//
// IKI AYRI SINYAL dondurur, karistirilmamali:
//   raw          → ICERIK: en yeni canli dump (donanim/tahrik bundan turetilir)
//   newestIsDead → PIYASA DURUMU: en yeni dump "ilan kalkmis" cevabi mi?
//
// newestIsDead neden guvenilir: apify-fetch-car.js dump dosyasini YALNIZCA Apify bir
// item dondurdugunde yazar. 403/oturum hatasinda chunk catch'e duser ve hic dosya
// yazilmaz (ilan sadece stale kalir). Dolayisiyla olu dump = Apify mobile.de'ye
// ulasti ve "bu ilan yok" cevabini aldi → satilmis/kaldirilmis sinyali.
//
//   donus: { raw, filename, ts, staleFallback, newestIsDead }
//          staleFallback: en yeni dump kullanilamadi, daha eskiye dusuldu.
//   icerik bulunamazsa: { raw: null, reason: 'noDump' | 'deadDump' | 'unreadable', newestIsDead }
export function readLiveDump(mobileDeId, index, dir = dumpDir) {
  const candidates = mobileDeId ? index[String(mobileDeId)] : null;
  if (!candidates?.length) return { raw: null, reason: 'noDump', newestIsDead: false };

  const readDump = (filename) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8'));
    } catch {
      return null; // bozuk dosya
    }
  };

  const newest = readDump(candidates[0].filename);
  // Yalnizca GERCEK olu cevap sinyal sayilir; okunamayan dosya "kalkmis" demek degil.
  const newestIsDead = newest !== null && isDeadDump(newest);

  let sawDead = false;
  for (const [position, candidate] of candidates.entries()) {
    const raw = position === 0 ? newest : readDump(candidate.filename);
    if (raw === null) continue;           // bozuk dosya — bir sonraki adaya gec
    if (isDeadDump(raw)) { sawDead = true; continue; }
    return { raw, filename: candidate.filename, ts: candidate.ts, staleFallback: position > 0, newestIsDead };
  }
  return { raw: null, reason: sawDead ? 'deadDump' : 'unreadable', newestIsDead };
}
