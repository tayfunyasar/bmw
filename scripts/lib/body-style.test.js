import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCabrio,
  isGranCoupe,
  classifyBodyStyle,
  rawCarToTextObj,
  rawCarApifyCategory,
} from './body-style.js';

test('isGranCoupe — explicit "Gran Coupe" variants', () => {
  assert.equal(isGranCoupe({ title: 'BMW M440i Gran Coupé' }), true);
  assert.equal(isGranCoupe({ title: 'BMW M440i Gran Coupe' }), true);
  assert.equal(isGranCoupe({ title: 'BMW M440i GranCoupe Premium' }), true);
  assert.equal(isGranCoupe({ title: 'BMW M440i Grand Coupé' }), true);
  assert.equal(isGranCoupe({ title: 'BMW M440i Gan Coupe (typo)' }), true);
});

test('isGranCoupe — chassis code G26', () => {
  assert.equal(isGranCoupe({ modelRange: 'G26' }), true);
  assert.equal(isGranCoupe({ description: 'Chassis: G26 facelift' }), true);
});

test('isGranCoupe — GC abbreviation, word-bounded', () => {
  assert.equal(isGranCoupe({ title: 'BMW M440i GC HUD' }), true);
  assert.equal(isGranCoupe({ subTitle: ' GC ' }), true);
});

test('isGranCoupe — GC abbreviation glued to xDr / xDrive', () => {
  assert.equal(isGranCoupe({ title: 'BMW M440i xDrGC M Pro Kamera' }), true);
  assert.equal(isGranCoupe({ title: 'BMW M440i xDriveGC HUD' }), true);
  assert.equal(isGranCoupe({ title: 'BMW M440i DrGC Sport' }), true);
});

test('isGranCoupe — does NOT trigger on random GC inside other words', () => {
  assert.equal(isGranCoupe({ title: 'BMW SOMETHINGGC random' }), false);
  assert.equal(isGranCoupe({ title: 'RANDOMGCSTUFF' }), false);
  assert.equal(isGranCoupe({ title: 'BMW M440i Coupe Laser' }), false);
});

test('classifyBodyStyle — equipment abbreviations (DAPRO/LivePro) do NOT trigger GC/Cabrio', () => {
  // "DAPRO" (Driving Assistant Professional) ve "LivePro" donanim kisaltmalaridir,
  // govde tipi sinyali degil — boyle bir baslik COUPE olarak siniflanmali.
  assert.equal(
    classifyBodyStyle({ title: 'BMW M440 i xDr Coupe,LivePro,Laser,DAPRO,Memory,360°' }),
    'COUPE'
  );
});

test('isCabrio — explicit Cabrio variants', () => {
  assert.equal(isCabrio({ title: 'BMW M440i Cabrio' }), true);
  assert.equal(isCabrio({ title: 'BMW M440i Cabriolet' }), true);
  assert.equal(isCabrio({ title: 'BMW M440i Convertible' }), true);
  assert.equal(isCabrio({ title: 'BMW M440i Cab. Edition' }), true);
  assert.equal(isCabrio({ title: 'BMW M440i Carbrio (typo)' }), true);
});

test('isCabrio — chassis code G23', () => {
  assert.equal(isCabrio({ modelRange: 'G23' }), true);
});

test('isCabrio — does NOT trigger on Coupé / Gran Coupé', () => {
  assert.equal(isCabrio({ title: 'BMW M440i Coupé' }), false);
  assert.equal(isCabrio({ title: 'BMW M440i Gran Coupé' }), false);
});

test('classifyBodyStyle — text-only fallback', () => {
  assert.equal(classifyBodyStyle({ title: 'BMW M440i Cabrio' }), 'CABRIO');
  assert.equal(classifyBodyStyle({ title: 'BMW M440i Gran Coupé' }), 'GRAN_COUPE');
  assert.equal(classifyBodyStyle({ title: 'BMW M440i Coupé' }), 'COUPE');
  assert.equal(classifyBodyStyle({ title: 'BMW M440i xDrive' }), 'COUPE');
});

test('classifyBodyStyle — Cabrio wins over GC if both signals present', () => {
  // CABRIO check runs before GC in the fallback path.
  assert.equal(classifyBodyStyle({ title: 'BMW M440i Gran Coupé Cabrio' }), 'CABRIO');
});

test('classifyBodyStyle — Apify Category overrides text signals', () => {
  // Convertible category beats a misleading "Coupe" in text.
  assert.equal(
    classifyBodyStyle({ title: 'BMW M440i Coupe' }, { apifyCategory: 'Convertible' }),
    'CABRIO'
  );
  // Saloon/Limousine = Gran Coupé, even with "Coupe" text.
  assert.equal(
    classifyBodyStyle({ title: 'BMW M440i Coupe' }, { apifyCategory: 'Saloon' }),
    'GRAN_COUPE'
  );
});

test('classifyBodyStyle — Sports Car/Coupe + GC text → GRAN_COUPE', () => {
  assert.equal(
    classifyBodyStyle(
      { title: 'BMW M440i xDrGC Pro' },
      { apifyCategory: 'Sports Car/Coupe' }
    ),
    'GRAN_COUPE'
  );
  assert.equal(
    classifyBodyStyle(
      { title: 'BMW M440i Gran Coupé', modelRange: 'G26' },
      { apifyCategory: 'Sports Car/Coupe' }
    ),
    'GRAN_COUPE'
  );
});

test('classifyBodyStyle — Sports Car/Coupe without GC signal → COUPE', () => {
  assert.equal(
    classifyBodyStyle(
      { title: 'BMW M440i Coupé Laser' },
      { apifyCategory: 'Sports Car/Coupe' }
    ),
    'COUPE'
  );
});

test('classifyBodyStyle — chassis-only signals when no Apify category', () => {
  assert.equal(classifyBodyStyle({ modelRange: 'G23' }), 'CABRIO');
  assert.equal(classifyBodyStyle({ modelRange: 'G26' }), 'GRAN_COUPE');
  assert.equal(classifyBodyStyle({ modelRange: 'G22' }), 'COUPE');
});

test('rawCarToTextObj — pulls Model range from attributes', () => {
  const raw = {
    title: 'T',
    subTitle: 'S',
    description: 'D',
    category: 'C',
    attributes: { 'Model range': 'G26', Category: 'Saloon' },
  };
  assert.deepEqual(rawCarToTextObj(raw), {
    title: 'T',
    subTitle: 'S',
    description: 'D',
    category: 'C',
    modelRange: 'G26',
  });
});

test('rawCarToTextObj — handles missing attributes', () => {
  assert.deepEqual(rawCarToTextObj({}), {
    title: '',
    subTitle: '',
    description: '',
    category: '',
    modelRange: '',
  });
});

test('rawCarApifyCategory — extracts Category attribute', () => {
  assert.equal(
    rawCarApifyCategory({ attributes: { Category: 'Sports Car/Coupe' } }),
    'Sports Car/Coupe'
  );
  assert.equal(rawCarApifyCategory({}), '');
});
