import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { determineTargetFile, sellerDamagePolicy } from './route-listing.js';
import { rerouteAfterMerge } from './reroute-listing.js';
import { readCar, writeCar } from './listings-store.js';

const parsedCar = (sellerTypeOrName = 'Normal Dealer') => ({
  sellerTypeOrName,
  equipmentFeatures: { S403A: 'yes' },
});

test('Crash Cars ilanlari otomatik agir hasarli sayilir', () => {
  const raw = { dealer: { name: 'Crash Cars', contry: 'DE' }, title: 'BMW M440i xDrive' };
  const car = parsedCar('Crash Cars ★4.7');
  const result = determineTargetFile(car, raw);

  assert.equal(result.target, 'COUPE_GAS_WITH_SUNROOF_KAZALI');
  assert.match(result.reason, /Satıcı politikası/);
  assert.equal(car.kazaliSeverity, 'major');
});

test('satici politikasi rating ekli parse edilmis adla da eslesir', () => {
  const car = parsedCar('Crash Cars ★4.7');
  const policy = sellerDamagePolicy({}, car);

  assert.equal(policy?.severity, 'major');
});

test('diger saticilar agir hasar politikasindan etkilenmez', () => {
  assert.equal(sellerDamagePolicy({ dealer: { name: 'BMW Autohaus' } }), null);
});

test('C1101 — 61AT VIN celiskili Coupe alanlarini ezer ve CABRIO hedefi verir', () => {
  const raw = {
    title: 'BMW M440i Coupe xD M Sport Pro',
    attributes: { Category: 'Sports Car/Coupe', 'Model range': 'G22' },
    properties: { fuelType: 'Petrol' },
  };
  const car = { ...parsedCar(), vin: 'WBA61AT090CN76352' };
  const result = determineTargetFile(car, raw);
  assert.equal(result.target, 'CABRIO');
  assert.match(result.bodyStyleReason, /61AT.*G23/);
});

test('Cabrio + hasar birlikteyse CABRIO_KAZALI hedefi verir', () => {
  const raw = {
    title: 'BMW M440i Cabrio',
    isDamaged: true,
    attributes: { Category: 'Sports Car/Coupe' },
    properties: { fuelType: 'Petrol' },
  };
  assert.equal(determineTargetFile(parsedCar(), raw).target, 'CABRIO_KAZALI');
});

test('bayi merge ile 61AT VIN kazanan aktif ilan ayni ID ile CABRIO klasorune tasinir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmw-reroute-'));
  try {
    const car = {
      listingId: 'C1101',
      vin: 'WBA61AT090CN76352',
      equipmentFeatures: { S403A: 'no' },
      auditHistory: [],
    };
    const raw = {
      title: 'BMW M440i Coupe xD M Sport Pro',
      attributes: { Category: 'Sports Car/Coupe', 'Model range': 'G22' },
      properties: { fuelType: 'Petrol' },
    };
    writeCar('COUPE_GAS_WITH_SUNROOF', car, dir);

    const moved = rerouteAfterMerge({
      sourceCategory: 'COUPE_GAS_WITH_SUNROOF', car, rawCar: raw, dir,
    });

    assert.equal(moved.to, 'CABRIO');
    assert.equal(readCar('COUPE_GAS_WITH_SUNROOF', 'C1101', dir), null);
    assert.equal(readCar('CABRIO', 'C1101', dir)?.listingId, 'C1101');
    assert.match(readCar('CABRIO', 'C1101', dir).auditHistory.at(-1).detail, /61AT.*G23/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
