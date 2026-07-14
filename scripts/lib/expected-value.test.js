import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBaseRates, unknownsExpectedValue, unknownsExpectedScore } from '../../src/utils/expectedValue.js';

const car = (ef) => ({ equipmentFeatures: ef });

// --- computeBaseRates (Laplace add-1) ---

test('computeBaseRates — tumu yes (18/0) → yuksek ama 1.0 degil', () => {
  const cars = Array.from({ length: 18 }, () => car({ X: 'yes' }));
  const r = computeBaseRates(cars, [{ code: 'X' }]);
  assert.equal(Math.round(r.X * 100), 95); // (18+1)/(18+0+2) = 19/20
});

test('computeBaseRates — dengeli (1/1) → %50', () => {
  const cars = [car({ X: 'yes' }), car({ X: 'no' })];
  const r = computeBaseRates(cars, [{ code: 'X' }]);
  assert.equal(r.X, 0.5); // (1+1)/(1+1+2)
});

test('computeBaseRates — hic bilinmiyor (hepsi unknown) → notr %50', () => {
  const cars = [car({ X: 'unknown' }), car({ X: 'unknown' })];
  const r = computeBaseRates(cars, [{ code: 'X' }]);
  assert.equal(r.X, 0.5); // (0+1)/(0+0+2) — unknown paydaya girmez
});

test('computeBaseRates — nadir (0 yes / 10 no) → dusuk', () => {
  const cars = Array.from({ length: 10 }, () => car({ X: 'no' }));
  const r = computeBaseRates(cars, [{ code: 'X' }]);
  assert.ok(r.X < 0.1, `beklenen <0.1, gelen ${r.X}`); // (0+1)/(0+10+2) ≈ 0.083
});

// --- unknownsExpectedValue ---

test('unknownsExpectedValue — yes/no katki vermez, sadece unknown', () => {
  const rules = [
    { code: 'A', price: 1000, score: 2 },
    { code: 'B', price: 1000, score: 2 },
    { code: 'C', price: 1000, score: 2 },
  ];
  const baseRates = { A: 0.5, B: 0.5, C: 0.5 };
  const ef = { A: 'yes', B: 'no', C: 'unknown' };
  // sadece C: 1000*2*0.5 = 1000
  assert.equal(unknownsExpectedValue(ef, rules, baseRates), 1000);
});

test('unknownsExpectedValue — score=0 donanim sayilmaz', () => {
  const rules = [{ code: 'Z', price: 500, score: 0 }];
  assert.equal(unknownsExpectedValue({ Z: 'unknown' }, rules, { Z: 1 }), 0);
});

test('unknownsExpectedValue — base-rate agirligi price*score ile carpilir', () => {
  const rules = [{ code: 'A', price: 2000, score: 3 }];
  // 2000*3*0.6 = 3600
  assert.equal(unknownsExpectedValue({ A: 'unknown' }, rules, { A: 0.6 }), 3600);
});

test('unknownsExpectedValue — baseRate yoksa 0 kredi (defansif)', () => {
  const rules = [{ code: 'A', price: 2000, score: 3 }];
  assert.equal(unknownsExpectedValue({ A: 'unknown' }, rules, {}), 0);
});

// --- unknownsExpectedScore (price'siz, expectedCriticalScore icin) ---

test('unknownsExpectedScore — sadece unknown, score×baseRate toplar (fractional)', () => {
  const rules = [
    { code: 'A', price: 1000, score: 3 },
    { code: 'B', price: 1000, score: 2 },
    { code: 'C', price: 1000, score: 1 },
  ];
  const baseRates = { A: 0.5, B: 1, C: 0.5 };
  const ef = { A: 'unknown', B: 'yes', C: 'no' };
  // sadece A: 3*0.5 = 1.5 (price etkilemez)
  assert.equal(unknownsExpectedScore(ef, rules, baseRates), 1.5);
});

test('unknownsExpectedScore — score=0 sayilmaz, baseRate yoksa 0', () => {
  const rules = [{ code: 'Z', price: 500, score: 0 }, { code: 'A', price: 100, score: 2 }];
  assert.equal(unknownsExpectedScore({ Z: 'unknown', A: 'unknown' }, rules, { Z: 1 }), 0);
});
