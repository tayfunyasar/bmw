import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRelistIntoRoot, RELIST_ACTION } from './merge-relist.js';

test('mergeRelistIntoRoot — yeni kaydin audit gecmisi koke tasinir ve tarihe gore siralanir (C235/C266, 2026-09-01)', () => {
  const root = {
    listingId: 'C235', mobileDeId: '454011133', listingUrl: 'u-old', possibleTwinOf: null,
    listingDates: { createdTime: '2026-05-05T00:00:00.000Z' },
    auditHistory: [
      { action: 'İlan Eklendi', auditDate: '2026-05-05T00:00:00.000Z' },
      { action: 'İlan Satıldı', auditDate: '2026-05-18T00:00:00.000Z' },
      { action: 'İlan Güncellemesi (Otomatik)', auditDate: '2026-08-02T00:00:00.000Z' },
    ],
  };
  const newCar = {
    listingId: 'C266', mobileDeId: '456054682', listingUrl: 'u-new', possibleTwinOf: 'C235',
    listingDates: { createdTime: '2026-05-18T09:18:47.000Z' },
    auditHistory: [
      { action: 'İlan Yayınlandı (mobile.de)', auditDate: '2026-05-18T09:18:47.000Z' },
      { action: 'İlan Güncellemesi (Otomatik)', auditDate: '2026-08-16T00:00:00.000Z', changes: { basePriceEuro: { old: 55900, new: 54900 } } },
    ],
  };
  const { changes } = mergeRelistIntoRoot(root, newCar, '2026-09-01T16:00:00.000Z');
  assert.equal(root.mobileDeId, '456054682');
  assert.equal(root.listingUrl, 'u-new');
  assert.equal(root.listingDates.createdTime, '2026-05-18T09:18:47.000Z');
  assert.equal(root.possibleTwinOf, null);
  assert.deepEqual(changes.mobileDeId, { old: '454011133', new: '456054682' });
  // 3 kok + 2 yeni + 1 re-list girdisi; siralama tarihe gore, re-list SONDA
  assert.equal(root.auditHistory.length, 6);
  assert.deepEqual(root.auditHistory.map(h => h.auditDate.slice(0, 10)),
    ['2026-05-05', '2026-05-18', '2026-05-18', '2026-08-02', '2026-08-16', '2026-09-01']);
  assert.equal(root.auditHistory.at(-1).action, RELIST_ACTION);
  assert.equal(root.auditHistory.find(h => h.changes?.basePriceEuro)?.changes.basePriceEuro.new, 54900, 'fiyat gecmisi korunur');
});
