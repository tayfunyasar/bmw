import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isValidListingId, maxListingIdNumber, createIdAllocator } from './listing-id.js';

// --- isValidListingId ---

test('isValidListingId — gecerli seriler', () => {
  assert.equal(isValidListingId('C1'), true);
  assert.equal(isValidListingId('C1045'), true);
  assert.equal(isValidListingId('W2'), true);
  assert.equal(isValidListingId('BMW12'), true);
});

test('isValidListingId — URL parcasindan turemis bozuk ID reddedilir', () => {
  // Gercek regresyon: `id=445587983` gibi kayitlar agaca sizmis, tarama
  // raporunda listingId yerine ham query string gorunmustu.
  assert.equal(isValidListingId('id=445587983'), false);
  assert.equal(isValidListingId('Old_7'), false);
  assert.equal(isValidListingId('c12'), false, 'kucuk harf onek gecersiz');
  assert.equal(isValidListingId('C'), false, 'sayisiz onek gecersiz');
  assert.equal(isValidListingId('12'), false, 'oneksiz sayi gecersiz');
  assert.equal(isValidListingId('C12a'), false);
});

test('isValidListingId — string olmayan girdi', () => {
  assert.equal(isValidListingId(null), false);
  assert.equal(isValidListingId(undefined), false);
  assert.equal(isValidListingId(12), false);
});

// --- tahsis: dosya adlari kaynak ---

const withTree = (files, fn) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'listing-id-'));
  try {
    for (const [rel, body] of Object.entries(files)) {
      const p = path.join(dir, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, body);
    }
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test('maxListingIdNumber — sadece tam onek eslesmesini sayar', () => {
  withTree({
    'COUPE_GAS_WITH_SUNROOF/C7.json': '{}',
    'COUPE_GAS_WITH_SUNROOF/C1045.json': '{}',
    'WELLER/CABRIO/W3.json': '{}'
  }, dir => {
    assert.equal(maxListingIdNumber('C', dir), 1045);
    assert.equal(maxListingIdNumber('W', dir), 3);
    assert.equal(maxListingIdNumber('N', dir), 0, 'hic yoksa 0');
  });
});

test('createIdAllocator — ardisik ve carpismasiz ID uretir', () => {
  withTree({ 'GRAN_COUPE/C1045.json': '{}' }, dir => {
    const alloc = createIdAllocator('C', dir);
    assert.equal(alloc.next(), 'C1046');
    assert.equal(alloc.next(), 'C1047');
    assert.equal(isValidListingId(alloc.next()), true);
  });
});
