import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCabrio,
  isGranCoupe,
  classifyBodyStyle,
  determineBodyStyle,
  bodyStyleFromHeading,
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

test('isGranCoupe — "G.C." dotted abbreviation', () => {
  // mobile.de ilan basliklarinda Gran Coupé "G.C." olarak da kisaltiliyor.
  assert.equal(
    isGranCoupe({ title: 'BMW M440i xDrive G.C. St+Go KomZu HdUp DA Laser 19"' }),
    true
  );
  assert.equal(isGranCoupe({ subTitle: 'i xDrive G.C. Laser' }), true);
  assert.equal(isGranCoupe({ title: 'BMW M440i G.C HUD' }), true);
  // Noktali yazim da kelime ortasindaki rastgele GC'yi tetiklememeli.
  assert.equal(isGranCoupe({ title: 'BMW G.Class Concept' }), false);
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

test('classifyBodyStyle — acik guncel baslik Apify Category alanini ezer', () => {
  assert.equal(
    classifyBodyStyle({ title: 'BMW M440i Coupe' }, { apifyCategory: 'Convertible' }),
    'COUPE'
  );
  assert.equal(
    classifyBodyStyle({ title: 'BMW M440i Cabrio' }, { apifyCategory: 'Sports Car/Coupe' }),
    'CABRIO'
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
  // Gercek ilan (mobileDeId 449292696 / C281): Apify "Sports Car/Coupe"
  // donerken baslikta "G.C." gecen arac Gran Coupé olarak siniflanmali.
  assert.equal(
    classifyBodyStyle(
      { title: 'BMW M440i xDrive G.C. St+Go KomZu HdUp DA Laser 19"' },
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

test('classifyBodyStyle — VIN fabrika kimligi tum celiskili ilan alanlarini ezer (C1101)', () => {
  const input = { title: 'BMW M440i Coupe xD M Sport Pro', modelRange: 'G22' };
  const opts = { apifyCategory: 'Sports Car/Coupe', vin: 'WBA61AT090CN76352' };
  assert.equal(classifyBodyStyle(input, opts), 'CABRIO');
  const result = determineBodyStyle(input, opts);
  assert.equal(result.certain, true);
  assert.match(result.reason, /61AT.*G23/);
});

test('classifyBodyStyle — Coupe VIN yanlis Cabrio basligini ezer', () => {
  assert.equal(
    classifyBodyStyle(
      { title: 'BMW M440i Cabrio', modelRange: 'G23' },
      { apifyCategory: 'Convertible', vin: 'WBA11AR010TEST1234' }
    ),
    'COUPE'
  );
});

test('bodyStyleFromHeading — Gran Coupe normal Coupe sayilmaz', () => {
  assert.equal(bodyStyleFromHeading('BMW M440i Gran Coupé'), 'GRAN_COUPE');
  assert.equal(bodyStyleFromHeading('BMW M440i Coupé'), 'COUPE');
  assert.equal(bodyStyleFromHeading('BMW M440i Cabrio'), 'CABRIO');
});

test('classifyBodyStyle — aciklama tek basina govde tasimaz', () => {
  assert.equal(
    classifyBodyStyle({ description: 'Open-Air Paket, Windschott, Nackenwärmer' }),
    'COUPE'
  );
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

// C1126 vakasi (2026-08-28): mobile.de "Model range" = "4-er Gran Coupe" iken
// "Category" = "Sports Car/Coupe" idi; kaba kategori kazandigi icin Gran Coupé
// COUPE havuzuna dusmustu. Model serisi adi kategoriden daha spesifiktir.
test('determineBodyStyle — Model range "Gran Coupe", Category "Sports Car/Coupe" ise GRAN_COUPE', () => {
  const r = determineBodyStyle(
    { title: 'BMW M440i xDrive SHZ LED Memory-Sitze', modelRange: '4-er Gran Coupe' },
    { apifyCategory: 'Sports Car/Coupe' }
  );
  assert.equal(r.type, 'GRAN_COUPE');
  assert.equal(r.certain, true);
});

test('determineBodyStyle — Model range Cabrio, Category "Sports Car/Coupe" ise CABRIO', () => {
  assert.equal(
    determineBodyStyle({ title: 'BMW M440i xDrive', modelRange: '4-er Cabrio' }, { apifyCategory: 'Sports Car/Coupe' }).type,
    'CABRIO'
  );
});

test('determineBodyStyle — Model range duz "4-er Coupe" ise COUPE kalir', () => {
  assert.equal(
    determineBodyStyle({ title: 'BMW M440i xDrive', modelRange: '4-er Coupe' }, { apifyCategory: 'Sports Car/Coupe' }).type,
    'COUPE'
  );
});

// VIN tip kodu 11AW = M440i xDrive Gran Coupé (G26) — C1126 vakasinda eklendi.
// Kanit: Unterberger Steckbrief "ANZAHL TÜREN 5 / SITZPLÄTZE 5" + mobile.de
// "Model range: 4-er Gran Coupe" (VIN WBA11AW0X0FR98053).
test('determineBodyStyle — 11AW VIN tip kodu Coupe iddiasini ezer (GRAN_COUPE)', () => {
  const r = determineBodyStyle(
    { title: 'BMW M440i xDrive Coupé', modelRange: '4-er Coupe' },
    { apifyCategory: 'Sports Car/Coupe', vin: 'WBA11AW0X0FR98053' }
  );
  assert.equal(r.type, 'GRAN_COUPE');
  assert.equal(r.certain, true);
});
