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
//   donus: { raw, filename, ts, staleFallback }  — staleFallback: en yeni dump oluydu,
//          daha eski bir canli dump'a dusuldu (veri guncel olmayabilir).
//   bulunamazsa: { raw: null, reason: 'noDump' | 'deadDump' | 'unreadable' }
export function readLiveDump(mobileDeId, index, dir = dumpDir) {
  const candidates = mobileDeId ? index[String(mobileDeId)] : null;
  if (!candidates?.length) return { raw: null, reason: 'noDump' };

  let sawDead = false;
  for (const [position, candidate] of candidates.entries()) {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(dir, candidate.filename), 'utf8'));
    } catch {
      continue; // bozuk dosya — bir sonraki adaya gec
    }
    if (isDeadDump(raw)) { sawDead = true; continue; }
    return { raw, filename: candidate.filename, ts: candidate.ts, staleFallback: position > 0 };
  }
  return { raw: null, reason: sawDead ? 'deadDump' : 'unreadable' };
}
