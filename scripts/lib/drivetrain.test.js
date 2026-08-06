import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  determineDrivetrain,
  determineDrivetrainFromRaw,
  AWD,
  RWD,
  FEATURE_AWD,
  FEATURE_RWD, typeCodeFromVin } from './drivetrain.js';

// --- 1. Metin ezer: xDrive / Allrad ---

test('metin xDrive diyorsa kesin xDrive — RWD checkbox olsa bile (C618/C207)', () => {
  const r = determineDrivetrain({
    title: 'BMW M440i Head-Up HK HiFi DAB WLAN GSD Komfortzg.',
    description: 'BMW M440i xDrive Coupé, Allrad, Vollausstattung',
    features: [FEATURE_RWD] // Apify checkbox RWD diyor — ama aciklama ezer
  });
  assert.equal(r.type, AWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 1.*"xDrive"/);
});

test('title xDrive diyorsa kesin xDrive', () => {
  const r = determineDrivetrain({ title: 'BMW M440i xDrive Coupé' });
  assert.equal(r.type, AWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 1/);
});

test('"x-drive" yazimi da yakalanir', () => {
  const r = determineDrivetrain({ description: 'M440i X-Drive Coupe' });
  assert.equal(r.type, AWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 1.*"X-Drive"/);
});

// --- 2. Metin ezer: Heckantrieb / Hinterradantrieb / literal RWD ---

test('aciklamada Heckantrieb -> kesin RWD (veride 0 karsi ornek)', () => {
  const r = determineDrivetrain({ description: 'BMW M440i Coupé, Heckantrieb, M Sportpaket' });
  assert.equal(r.type, RWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 2.*"Heckantrieb"/);
});

test('Hinterradantrieb -> kesin RWD', () => {
  const r = determineDrivetrain({ description: 'Hinterradantrieb, Automatik' });
  assert.equal(r.type, RWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 2.*"Hinterradantrieb"/);
});

test('title\'da literal "RWD" -> kesin RWD', () => {
  const r = determineDrivetrain({ title: 'BMW M440i RWD Coupé' });
  assert.equal(r.type, RWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 2.*başlığında "RWD"/);
});

test('ilan kendi icinde celisiyorsa (hem xDrive hem Heckantrieb) xDrive kazanir (C216)', () => {
  const r = determineDrivetrain({
    description: 'BMW M440i xDrive ... Heckantrieb',
    features: [FEATURE_RWD]
  });
  assert.equal(r.type, AWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 1/);
});

// --- 3-4. Metin sessiz -> checkbox karar verir ---

test('metin sessiz + "Rear wheel drive" checkbox -> RWD (C631/C252 — ASIL DUZELTME)', () => {
  const r = determineDrivetrain({
    title: 'BMW M440i fast Vollaust. noch 2,5 Jahre Garantie',
    description: 'Händler zwecklos, Festpreis!!! Laserlicht, Harman Kardon, Schiebedach',
    features: ['Alloy wheels', FEATURE_RWD, 'Leather steering wheel']
  });
  assert.equal(r.type, RWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 4.*Rear wheel drive/);
});

test('metin sessiz + "Four-wheel drive" checkbox -> kesin xDrive (C192 — sahte uyari kalkar)', () => {
  const r = determineDrivetrain({
    title: 'BMW M440i Coupé',
    description: 'Laserlicht, Head-Up Display',
    features: ['Alloy wheels', FEATURE_AWD]
  });
  assert.equal(r.type, AWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 3.*Four-wheel drive/);
});

// --- 5. Hicbir sinyal yok ---

test('hicbir tahrik sinyali yoksa xDrive varsayilir ama certain=false + not', () => {
  const r = determineDrivetrain({ title: 'BMW M440i Coupé', description: 'Sehr gepflegt' });
  assert.equal(r.type, AWD);
  assert.equal(r.certain, false);
  assert.match(r.note, /hiçbir sinyal yok/);
  assert.match(r.reason, /Kural 5/);
});

test('bos girdi patlamaz — xDrive uncertain doner', () => {
  const r = determineDrivetrain();
  assert.equal(r.type, AWD);
  assert.equal(r.certain, false);
});

// --- reason her dalda dolu: drivetrainReason alani asla bos kalmaz ---

test('her sonucta reason string olarak doner', () => {
  const cases = [
    { title: 'xDrive' },
    { description: 'Heckantrieb' },
    { title: 'BMW RWD' },
    { features: [FEATURE_AWD] },
    { features: [FEATURE_RWD] },
    {}
  ];
  for (const c of cases) {
    const r = determineDrivetrain(c);
    assert.equal(typeof r.reason, 'string');
    assert.ok(r.reason.length > 0);
  }
});

// --- checkbox token'lari birbirini disliyor: AWD once gelir ---

test('her iki checkbox da varsa (veride hic olmuyor) AWD kazanir', () => {
  const r = determineDrivetrain({ features: [FEATURE_RWD, FEATURE_AWD] });
  assert.equal(r.type, AWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 3/);
});

// --- ham Apify kaydi sarmalayicisi ---

test('determineDrivetrainFromRaw ham Apify kaydindan ayni sonucu verir', () => {
  const raw = {
    title: 'BMW M440i Coupé M Sport LiveCockpitProf Laser PDC',
    description: 'Scheckheftgepflegt, Laserlicht',
    url: 'https://suchen.mobile.de/auto-inserat/bmw-m440i/455490627.html',
    features: [FEATURE_RWD]
  };
  const r = determineDrivetrainFromRaw(raw);
  assert.equal(r.type, RWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 4.*Rear wheel drive/);
});

test('determineDrivetrainFromRaw eksik alanlarla patlamaz', () => {
  assert.equal(determineDrivetrainFromRaw({}).type, AWD);
  assert.equal(determineDrivetrainFromRaw().type, AWD);
});

// --- Kural 0: VIN tip kodu (C692 vakasi) ---
// C692'nin ilaninda hicbir yerde xDrive/Allrad/Heckantrieb gecmiyordu; sistem
// Kural 5'e dusup "xDrive varsayildi" diyordu. Bayi sayfasindan gelen VIN
// (WBA81AP010CN63825) tip kodunu veriyor: 81AP = arka cekis.

test('typeCodeFromVin — VIN 4-7. karakteri', () => {
  assert.equal(typeCodeFromVin('WBA81AP010CN63825'), '81AP');
  assert.equal(typeCodeFromVin('wba11ar0x0cxxxxxx'), '11AR');   // kucuk harf de calisir
});

test('typeCodeFromVin — kisa/bos/gecersiz girdi', () => {
  assert.equal(typeCodeFromVin('WBA81'), null);
  assert.equal(typeCodeFromVin(''), null);
  assert.equal(typeCodeFromVin(null), null);
  assert.equal(typeCodeFromVin(undefined), null);
});

test('determineDrivetrain — VIN 81AP arka cekis verir, metin sessiz olsa bile', () => {
  const r = determineDrivetrain({ title: 'BMW M440i Coupe Navi Leder ACC', vin: 'WBA81AP010CN63825' });
  assert.equal(r.type, RWD);
  assert.equal(r.certain, true);
  assert.match(r.reason, /Kural 0/);
});

test('determineDrivetrain — VIN metindeki "xDrive" iddiasini EZER', () => {
  // Fabrika verisi ilan metninden guvenilir; bayi yanlis yazmis olabilir.
  const r = determineDrivetrain({ title: 'BMW M440i xDrive Coupe', vin: 'WBA81AP010CN63825' });
  assert.equal(r.type, RWD);
  assert.match(r.reason, /Kural 0/);
});

test('determineDrivetrain — VIN checkbox sinyalini de ezer', () => {
  const r = determineDrivetrain({ features: ['Four-wheel drive'], vin: 'WBA81AP010CN63825' });
  assert.equal(r.type, RWD);
});

test('determineDrivetrain — 11AR xDrive verir', () => {
  const r = determineDrivetrain({ vin: 'WBA11AR010CN00001' });
  assert.equal(r.type, AWD);
  assert.equal(r.certain, true);
});

test('determineDrivetrain — taninmayan tip kodu Kural 0 tetiklemez', () => {
  // Tabloda olmayan kod → eski kurallar isler, VIN yok sayilir.
  const r = determineDrivetrain({ title: 'BMW M440i xDrive Coupe', vin: 'WBA99ZZ010CN00001' });
  assert.equal(r.type, AWD);
  assert.match(r.reason, /Kural 1/);
});

test('determineDrivetrain — VIN yoksa davranis degismez (regresyon)', () => {
  const r = determineDrivetrain({ title: 'BMW M440i Coupe' });
  assert.equal(r.type, AWD);
  assert.equal(r.certain, false);
  assert.match(r.reason, /Kural 5/);
});
