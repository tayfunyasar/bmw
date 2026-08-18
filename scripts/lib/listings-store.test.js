import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  rootCategories, dealerCategories, readCategory, readCar,
  writeCategory, removeCar, moveCar, walkCarFiles, findCar
} from './listings-store.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'store-test-'));

const seed = (dir, layout) => {
  for (const [relDir, cars] of Object.entries(layout)) {
    for (const car of cars) {
      const full = path.join(dir, relDir, `${car.listingId}.json`);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, JSON.stringify(car, null, 2) + '\n');
    }
  }
};

test('store — kok/bayi ayrimi DEALER_SITES site adlarina gore', () => {
  const dir = tmp();
  seed(dir, {
    'CABRIO': [{ listingId: 'C1' }],
    'WELLER/CABRIO': [{ listingId: 'W1' }],
  });
  assert.deepEqual(rootCategories(dir), ['CABRIO']);
  assert.deepEqual(dealerCategories(dir), [path.join('WELLER', 'CABRIO')]);
});

test('store — readCategory listingId sayisal sonekine gore siralar, olmayan klasor []', () => {
  const dir = tmp();
  seed(dir, { 'A': [{ listingId: 'C40' }, { listingId: 'C9' }, { listingId: 'C100' }] });
  assert.deepEqual(readCategory('A', dir).map(c => c.listingId), ['C9', 'C40', 'C100']);
  assert.deepEqual(readCategory('YOK', dir), []);
});

test('store — writeCategory listede olmayan dosyayi siler, bosalan klasoru kaldirir', () => {
  const dir = tmp();
  seed(dir, { 'A': [{ listingId: 'C1' }, { listingId: 'C2' }] });
  writeCategory('A', [{ listingId: 'C2', x: 1 }], dir);
  assert.equal(readCar('A', 'C1', dir), null, 'C1 dosyasi silinmeli');
  assert.equal(readCar('A', 'C2', dir).x, 1);
  writeCategory('A', [], dir);
  assert.ok(!fs.existsSync(path.join(dir, 'A')), 'bos kategori klasoru kalkmali');
});

test('store — moveCar dosyayi tasir, removeCar bos site klasorunu de kaldirir', () => {
  const dir = tmp();
  seed(dir, { 'WELLER/CABRIO': [{ listingId: 'W1' }], 'CABRIO': [{ listingId: 'C1' }] });
  const w1 = readCar(path.join('WELLER', 'CABRIO'), 'W1', dir);
  moveCar(path.join('WELLER', 'CABRIO'), path.join('WELLER', 'CABRIO_SOLD'), w1, dir);
  assert.equal(readCar(path.join('WELLER', 'CABRIO_SOLD'), 'W1', dir).listingId, 'W1');
  assert.ok(!fs.existsSync(path.join(dir, 'WELLER', 'CABRIO')), 'bosalan kategori kalkmali');
  removeCar(path.join('WELLER', 'CABRIO_SOLD'), 'W1', dir);
  assert.ok(!fs.existsSync(path.join(dir, 'WELLER')), 'bosalan site klasoru de kalkmali');
});

test('store — walkCarFiles kok + bayi, listingId dosya adindan', () => {
  const dir = tmp();
  seed(dir, { 'A': [{ listingId: 'C1' }], 'AHG/B': [{ listingId: 'A2' }] });
  const walked = walkCarFiles(dir).map(w => `${w.category}:${w.listingId}`).sort();
  assert.deepEqual(walked, ['A:C1', path.join('AHG', 'B') + ':A2']);
});

test('store — findCar mobileDeId veya listingId ile, kategori sirasi oncelik', () => {
  const dir = tmp();
  seed(dir, {
    'A': [{ listingId: 'C1', mobileDeId: '111' }],
    'B': [{ listingId: 'C2', mobileDeId: null }],
  });
  assert.equal(findCar('111', ['A', 'B'], dir).car.listingId, 'C1');
  assert.equal(findCar('C2', ['A', 'B'], dir).category, 'B');
  assert.equal(findCar('999', ['A', 'B'], dir), null);
});
