import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDumpIndex, readLiveDump, isDeadDump, DEAD_DUMP_TITLE } from './dumps.js';

// Gercek dump/ klasorune dokunmadan izole bir klasor kurar.
const makeDumpDir = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dumps-test-'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
};

const live = (extra = {}) => ({ title: 'BMW M440i', description: 'Laserscheinwerfer (05AZ)', ...extra });
const dead = { title: DEAD_DUMP_TITLE };

// --- isDeadDump ---

test('isDeadDump — kalkmis ilan basligi ve bos deger', () => {
  assert.equal(isDeadDump(dead), true);
  assert.equal(isDeadDump(null), true);
  assert.equal(isDeadDump(undefined), true);
  assert.equal(isDeadDump(live()), false);
});

// --- buildDumpIndex ---

test('buildDumpIndex — id bazinda gruplar, en yeniden eskiye sirali', () => {
  const dir = makeDumpDir({
    '111_1000.json': live(), '111_3000.json': live(), '111_2000.json': live(),
    '222_500.json': live(),
    'not-a-dump.txt': 'yoksay',
  });
  const index = buildDumpIndex(dir);
  assert.deepEqual(index['111'].map(d => d.ts), [3000, 2000, 1000]);
  assert.equal(index['222'].length, 1);
  assert.equal(index['not-a-dump'], undefined);
});

// --- readLiveDump: asil regresyon ---

test('readLiveDump — en yeni dump OLU ise daha eski CANLI dump kullanilir', () => {
  // C310 sinifi regresyon: ilan mobile.de'den kalkinca Apify bos kayit yazar; eskiden
  // "en yeni dump" secildigi icin ilan yeniden turetilemez sayiliyordu (69 ilan).
  const dir = makeDumpDir({
    '111_1000.json': live({ description: 'eski ama dolu' }),
    '111_9000.json': dead,
  });
  const result = readLiveDump('111', buildDumpIndex(dir), dir);
  assert.equal(result.raw.description, 'eski ama dolu');
  assert.equal(result.ts, 1000);
  assert.equal(result.staleFallback, true, 'eski dump kullanildigi isaretlenmeli');
});

test('readLiveDump — en yeni dump canliysa o kullanilir, staleFallback false', () => {
  const dir = makeDumpDir({
    '111_1000.json': live({ description: 'eski' }),
    '111_9000.json': live({ description: 'yeni' }),
  });
  const result = readLiveDump('111', buildDumpIndex(dir), dir);
  assert.equal(result.raw.description, 'yeni');
  assert.equal(result.staleFallback, false);
});

test('readLiveDump — tum dumplar oluysa reason=deadDump', () => {
  const dir = makeDumpDir({ '111_1000.json': dead, '111_2000.json': dead });
  const result = readLiveDump('111', buildDumpIndex(dir), dir);
  assert.equal(result.raw, null);
  assert.equal(result.reason, 'deadDump');
});

test('readLiveDump — hic dump yoksa reason=noDump', () => {
  const dir = makeDumpDir({ '111_1000.json': live() });
  const index = buildDumpIndex(dir);
  assert.equal(readLiveDump('999', index, dir).reason, 'noDump');
  assert.equal(readLiveDump(null, index, dir).reason, 'noDump');
  assert.equal(readLiveDump(undefined, index, dir).reason, 'noDump');
});

test('readLiveDump — bozuk JSON atlanir, bir sonraki canli dump kullanilir', () => {
  const dir = makeDumpDir({
    '111_9000.json': '{ bozuk json',
    '111_1000.json': live({ description: 'saglam' }),
  });
  const result = readLiveDump('111', buildDumpIndex(dir), dir);
  assert.equal(result.raw.description, 'saglam');
});

test('readLiveDump — mobileDeId sayi olarak verilse de bulunur', () => {
  const dir = makeDumpDir({ '111_1000.json': live() });
  assert.ok(readLiveDump(111, buildDumpIndex(dir), dir).raw);
});

// --- newestIsDead: piyasa durumu sinyali (icerikten AYRI) ---
// Regresyon: bu iki sinyal eskiden ayni sey saniliyordu. Olu dump gorulunce ilan
// SOLD'a tasiniyor ama verisi hic tazelenmiyordu; "en yeni canli dump"a gecince de
// satilmis sinyali tamamen kaybolmustu. Ikisi ayri dondurulur.

test('readLiveDump — en yeni dump oluyken newestIsDead true, icerik yine de gelir', () => {
  const dir = makeDumpDir({
    '111_1000.json': live({ description: 'eski ama dolu' }),
    '111_9000.json': dead,
  });
  const r = readLiveDump('111', buildDumpIndex(dir), dir);
  assert.equal(r.newestIsDead, true, 'satilmis sinyali');
  assert.equal(r.raw.description, 'eski ama dolu', 'icerik yine de turetilebilir');
});

test('readLiveDump — en yeni dump canliysa newestIsDead false', () => {
  const dir = makeDumpDir({ '111_1000.json': dead, '111_9000.json': live() });
  const r = readLiveDump('111', buildDumpIndex(dir), dir);
  assert.equal(r.newestIsDead, false, 'ilan yeniden yayina girmis — satilmis sayilmaz');
});

test('readLiveDump — tum dumplar oluyken newestIsDead true, icerik yok', () => {
  const dir = makeDumpDir({ '111_1000.json': dead, '111_2000.json': dead });
  const r = readLiveDump('111', buildDumpIndex(dir), dir);
  assert.equal(r.newestIsDead, true);
  assert.equal(r.raw, null);
  assert.equal(r.reason, 'deadDump');
});

test('readLiveDump — BOZUK en yeni dosya "kalkmis" sayilmaz', () => {
  // Okunamayan dosya bir cevap degil; yanlislikla SOLD'a tasimaya yol acmamali.
  const dir = makeDumpDir({ '111_9000.json': '{ bozuk', '111_1000.json': live() });
  const r = readLiveDump('111', buildDumpIndex(dir), dir);
  assert.equal(r.newestIsDead, false);
  assert.ok(r.raw);
});

test('readLiveDump — dump yoksa newestIsDead false (403 = sinyal degil)', () => {
  // 403/oturum hatasinda apify-fetch-car.js hic dosya yazmaz → "satildi" DEMEK DEGIL.
  const dir = makeDumpDir({ '111_1000.json': live() });
  assert.equal(readLiveDump('999', buildDumpIndex(dir), dir).newestIsDead, false);
});
