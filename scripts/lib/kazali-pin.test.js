import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isManuallyMarkedKazali, KAZALI_AUDIT_ACTION } from './move-listing.js';

// Regresyon: C290/C315 vakasi. Kullanici bu iki araci elle kazali isaretlemisti;
// KAZALI dosyalari parse-car-json.js'te activeFiles'ta oldugu icin, Apify metninde
// hasar kelimesi gecmeyince ikisi de otomatik olarak temiz havuza geri tasindi.
// Insan karari otomatik siniflandirmaya yenilmemeli.

test('KAZALI_AUDIT_ACTION — mark-kazali.js ile parse-car-json.js ayni string uzerinde anlasir', () => {
  assert.equal(KAZALI_AUDIT_ACTION, 'Kazalı İşaretlendi');
});

test('isManuallyMarkedKazali — manuel isaret audit kaydini tanir', () => {
  const car = {
    auditHistory: [
      { action: 'İlan Eklendi' },
      { action: KAZALI_AUDIT_ACTION, detail: 'COUPE_GAS_WITH_SUNROOF.json → ... — Manuel işaretlendi' },
    ],
  };
  assert.equal(isManuallyMarkedKazali(car), true);
});

test('isManuallyMarkedKazali — otomatik yonlendirilmis (manuel isaretsiz) ilan sabit degil', () => {
  const car = {
    auditHistory: [
      { action: 'İlan Eklendi' },
      { action: 'Dosya Taşıma: COUPE_GAS_WITH_SUNROOF → COUPE_GAS_WITH_SUNROOF_KAZALI' },
    ],
  };
  assert.equal(isManuallyMarkedKazali(car), false);
});

test('isManuallyMarkedKazali — auditHistory yok/bos/gecersiz girdi', () => {
  assert.equal(isManuallyMarkedKazali({}), false);
  assert.equal(isManuallyMarkedKazali({ auditHistory: [] }), false);
  assert.equal(isManuallyMarkedKazali(null), false);
  assert.equal(isManuallyMarkedKazali(undefined), false);
});

test('pin kurali — yalnizca KAZALI kaynak dosyalarinda uygulanir', () => {
  // parse-car-json.js'teki kosulun aynisi: source.name.includes('KAZALI') && manuel
  const pinned = (sourceName, car) => sourceName.includes('KAZALI') && isManuallyMarkedKazali(car);
  const manual = { auditHistory: [{ action: KAZALI_AUDIT_ACTION }] };
  assert.equal(pinned('COUPE_GAS_WITH_SUNROOF_KAZALI', manual), true);
  assert.equal(pinned('GRAN_COUPE_KAZALI', manual), true);
  // Kazali isareti tasiyip sonra temize alinmis bir arac aktif dosyadayken kilitlenmez
  assert.equal(pinned('COUPE_GAS_WITH_SUNROOF', manual), false);
});
