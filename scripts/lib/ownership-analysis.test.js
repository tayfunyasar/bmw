import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeOwnership, estimateFutureResale } from '../../src/utils/ownershipAnalysis.js';

const car = (id, age, km, cost, sold = false) => ({
  listingId: id,
  sourceCategory: sold ? 'COUPE_GAS_WITH_SUNROOF_SOLD' : 'COUPE_GAS_WITH_SUNROOF',
  isSold: sold,
  mileageKm: km,
  basePriceEuro: cost,
  firstRegistrationYearAndMonth: [2023, 1],
  metrics: { ageInMonths: age, baseTotalCost: cost, expectedFeaturesValue: 10000 },
});

test('estimateFutureResale — araci 15 ay ve kullanilan km kadar ileri tasir', () => {
  const candidate = car('A', 30, 20000, 60000);
  const refs = [car('R1', 45, 38000, 54000, true), car('R2', 46, 39000, 53000, true), car('R3', 44, 37000, 55000, true)];
  const result = estimateFutureResale(candidate, refs, { annualKm: 14400 });

  assert.equal(result.futureAgeMonths, 45);
  assert.equal(result.futureMileageKm, 38000);
  assert.ok(result.depreciationCost > 0);
  assert.equal(result.neighborIds[0], 'R1');
});

test('analyzeOwnership — en dusuk kayipli adayi ilk siraya koyar, kazaliyi dislar', () => {
  const refs = [car('R1', 45, 38000, 56000, true), car('R2', 46, 39000, 55000, true), car('R3', 44, 37000, 57000, true)];
  const cheap = car('CHEAP', 30, 20000, 57000);
  const expensive = car('EXPENSIVE', 30, 20000, 70000);
  const damaged = { ...car('DAMAGED', 30, 20000, 50000), isKazali: true, sourceCategory: 'COUPE_GAS_WITH_SUNROOF_KAZALI' };
  const result = analyzeOwnership([expensive, damaged, cheap], refs);

  assert.deepEqual(result.results.map(x => x.car.listingId), ['CHEAP', 'EXPENSIVE']);
  assert.equal(result.criteria.sampleSize, 1, 'optimal bant yalniz en iyiye €5K yakin adaylardan olusur');
});

test('analyzeOwnership — tescil tarihi bilinmeyen ve sifir km kayitlari dislar', () => {
  const refs = [car('R1', 45, 38000, 56000, true), car('R2', 46, 39000, 55000, true), car('R3', 44, 37000, 57000, true)];
  const missingRegistration = { ...car('ZERO', 0, 0, 100000), firstRegistrationYearAndMonth: [null, null] };
  const valid = car('VALID', 30, 20000, 57000);
  const result = analyzeOwnership([missingRegistration, valid], [...refs, missingRegistration]);

  assert.deepEqual(result.results.map(x => x.car.listingId), ['VALID']);
  assert.equal(result.referenceCount, 3);
  assert.equal(result.criteria.kmMin, 20000);
});

test('estimateFutureResale — daha fazla yillik km daha yuksek satis degeri uretemez', () => {
  const candidate = car('A', 30, 20000, 60000);
  const refs = [car('R1', 45, 38000, 54000, true), car('R2', 46, 39000, 53000, true), car('R3', 44, 37000, 55000, true)];
  const lowUsage = estimateFutureResale(candidate, refs, { annualKm: 10000 });
  const highUsage = estimateFutureResale(candidate, refs, { annualKm: 20000 });

  assert.ok(lowUsage.conservativeResaleValue > highUsage.conservativeResaleValue);
  assert.ok(lowUsage.depreciationCost < highUsage.depreciationCost);
});
