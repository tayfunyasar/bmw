import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDumpIndex, DEAD_DUMP_TITLE } from './dumps.js';
import { adState } from './ad-state.js';

const makeDumpDir = (files) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ad-state-test-'));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), JSON.stringify(content));
  return dir;
};
const live = { title: 'BMW M440i', description: 'dolu' };
const dead = { title: DEAD_DUMP_TITLE };

test('adState — en yeni dump OLU, eski dump dolu → dead (C853/C1153 regresyonu, 2026-09-01)', () => {
  // readLiveDump icerik icin eski dolu dump'a duser (raw dolu) ama piyasa durumu OLUDUR.
  const dir = makeDumpDir({ '111_1000.json': live, '111_9000.json': dead });
  assert.equal(adState('111', buildDumpIndex(dir), dir), 'dead');
});

test('adState — en yeni dump canli → alive', () => {
  const dir = makeDumpDir({ '111_1000.json': dead, '111_9000.json': live });
  assert.equal(adState('111', buildDumpIndex(dir), dir), 'alive');
});

test('adState — yalniz olu dump → dead; dump yok → unknown; id yok → unknown', () => {
  const dir = makeDumpDir({ '111_9000.json': dead });
  const index = buildDumpIndex(dir);
  assert.equal(adState('111', index, dir), 'dead');
  assert.equal(adState('222', index, dir), 'unknown');
  assert.equal(adState(null, index, dir), 'unknown');
});
