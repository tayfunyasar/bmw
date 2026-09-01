import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEXT_SIGNALS, matchAnyWord, wordToRegex, detectMarginVat } from './text-signals.js';
import { determineDrivetrain, AWD, RWD } from './drivetrain.js';

// Kelime tablolari KODDA DEGIL config'te olmali — bu test "birisi tekrar koda gomerse"
// diye duruyor (2026-09-01: drivetrain regex'leri ve MAJOR_DAMAGE_SELLERS koddaydi).

test('TEXT_SIGNALS — beklenen bolumler config\'te tanimli', () => {
  assert.ok(TEXT_SIGNALS.drivetrain.awdWords.length > 0);
  assert.ok(TEXT_SIGNALS.drivetrain.rwdWords.length > 0);
  assert.ok(TEXT_SIGNALS.damage.words.length > 0);
  assert.ok(TEXT_SIGNALS.damage.negationWords.length > 0);
  assert.ok(Array.isArray(TEXT_SIGNALS.damage.majorSellers));
  assert.ok(TEXT_SIGNALS.vat.marginWords.length > 0);
});

test('wordToRegex — kelimedeki bosluk metinde opsiyonel bosluk/tire demek', () => {
  const re = wordToRegex('x drive');
  for (const form of ['xDrive', 'X-Drive', 'x drive', 'XDRIVE']) assert.match(form, re);
});

test('matchAnyWord — metindeki HALINI dondurur, yoksa null', () => {
  assert.equal(matchAnyWord('BMW M440i X-Drive Coupé', ['x drive', 'allrad']), 'X-Drive');
  assert.equal(matchAnyWord('BMW 430i Coupé', ['x drive', 'allrad']), null);
});

// Flemenkce kaliplar (BMW_NL sitesi) — skill dosyasina degil config'e ait.
test('Flemenkce tahrik kaliplari config uzerinden calisir (BMW_NL)', () => {
  const rwd = determineDrivetrain({ description: 'Aandrijving: achterwielaandrijving' });
  assert.equal(rwd.type, RWD);
  assert.match(rwd.reason, /Kural 2/);

  const awd = determineDrivetrain({ description: 'Aandrijving: Vierwielaandrijving' });
  assert.equal(awd.type, AWD);
  assert.match(awd.reason, /Kural 1/);
});

test('detectMarginVat — NL/DE marj beyanini yakalar, KDV\'li araci yakalamaz', () => {
  assert.ok(detectMarginVat('BTW verrekenbaar: Nee'));
  assert.ok(detectMarginVat('Dit is een margeauto'));
  assert.ok(detectMarginVat('Fahrzeug differenzbesteuert nach § 25a UStG'));
  assert.equal(detectMarginVat('BTW verrekenbaar: Ja'), null);
  assert.equal(detectMarginVat('MwSt. ausweisbar 19%'), null);
});
