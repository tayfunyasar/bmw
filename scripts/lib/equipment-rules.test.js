import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchEquipmentFeatures, explainEquipmentFeatures, normalizeText, optionCodeOf } from './equipment-match.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EQUIPMENT_RULES = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../src/data/metadata/EQUIPMENT_RULES.json'),
    'utf8'
  )
);

// --- normalizeText ---

test('normalizeText — lowercases and converts dashes to spaces', () => {
  assert.equal(normalizeText('Driving-Assistant'), 'driving assistant');
  assert.equal(normalizeText('HEAD–UP'), 'head up'); // uzun tire (en-dash)
  assert.equal(normalizeText(''), '');
  assert.equal(normalizeText(), '');
});

// --- matchEquipmentFeatures: eslestirme oncelik sirasi ---

test('matchEquipmentFeatures — positive description match → yes', () => {
  const rules = [{ code: 'X', description: ['Glasdach'] }];
  assert.equal(matchEquipmentFeatures({ description: 'mit großem Glasdach' }, rules).X, 'yes');
});

test('matchEquipmentFeatures — negativeDescription → no', () => {
  const rules = [{ code: 'X', description: ['ABC'], negativeDescription: ['XYZ'] }];
  assert.equal(matchEquipmentFeatures({ description: 'has XYZ here' }, rules).X, 'no');
});

test('matchEquipmentFeatures — positive description beats negativeDescription', () => {
  const rules = [{ code: 'X', description: ['ABC'], negativeDescription: ['XYZ'] }];
  assert.equal(matchEquipmentFeatures({ description: 'ABC and XYZ' }, rules).X, 'yes');
});

test('matchEquipmentFeatures — features array match → yes', () => {
  const rules = [{ code: 'X', description: [], features: ['Navigation system'] }];
  assert.equal(matchEquipmentFeatures({ features: ['Navigation system'] }, rules).X, 'yes');
});

test('matchEquipmentFeatures — props match → yes', () => {
  const rules = [{ code: 'X', props: { upholstery: ['Leder'] } }];
  assert.equal(
    matchEquipmentFeatures({ props: { upholstery: 'Schwarz Leder' } }, rules).X,
    'yes'
  );
});

test('matchEquipmentFeatures — no signal + non-informative description → unknown (fren)', () => {
  const rules = [{ code: 'X', description: ['ABC'], features: ['F'] }];
  assert.equal(matchEquipmentFeatures({ description: 'nothing here' }, rules).X, 'unknown');
});

// --- Fallback: bilgilendirici description → "no", aksi halde "unknown" (fren) ---

test('matchEquipmentFeatures — informative description (≥3 hit) → eslesmeyen kural "no"', () => {
  const rules = [
    { code: 'A', description: ['aaa'] },
    { code: 'B', description: ['bbb'] },
    { code: 'C', description: ['ccc'] },
    { code: 'MISSING', description: ['zzz'], defaultStatus: 'no' },
  ];
  const r = matchEquipmentFeatures({ description: 'aaa bbb ccc' }, rules);
  assert.equal(r.A, 'yes');
  assert.equal(r.MISSING, 'no'); // prose bilgilendirici, "zzz" yok → gercekten yok
});

test('matchEquipmentFeatures — non-informative description → fren "unknown" birakir', () => {
  const rules = [
    { code: 'A', description: ['aaa'] },
    { code: 'MISSING', description: ['zzz'], defaultStatus: 'no' },
  ];
  // sadece 1 hit (<3) → bilgilendirici degil → absence guvenilmez
  const r = matchEquipmentFeatures({ description: 'aaa only, rest is marketing prose' }, rules);
  assert.equal(r.MISSING, 'unknown');
});

test('matchEquipmentFeatures — defaultStatus "unknown", bilgilendirici description\'da bile korunur', () => {
  const rules = [
    { code: 'A', description: ['aaa'] },
    { code: 'B', description: ['bbb'] },
    { code: 'C', description: ['ccc'] },
    { code: 'AMBIG', description: ['zzz'], defaultStatus: 'unknown' },
  ];
  const r = matchEquipmentFeatures({ description: 'aaa bbb ccc' }, rules);
  assert.equal(r.AMBIG, 'unknown'); // kurator bilerek ambigü birakmis (ör. Harman Kardon)
});

test('matchEquipmentFeatures — checkbox eslesmesi frenden bagimsiz "yes" verir', () => {
  const rules = [
    { code: 'A', description: ['aaa'] },
    { code: 'CHK', description: ['zzz'], features: ['SomeFeature'] },
  ];
  // description bilgilendirici olmasa da checkbox pozitif sinyal → yes
  const r = matchEquipmentFeatures({ description: 'aaa', features: ['SomeFeature'] }, rules);
  assert.equal(r.CHK, 'yes');
});

test('matchEquipmentFeatures — defaultStatus yoksa bilgilendirici description\'da "no"', () => {
  const rules = [
    { code: 'A', description: ['aaa'] },
    { code: 'B', description: ['bbb'] },
    { code: 'C', description: ['ccc'] },
    { code: 'NODEFAULT', description: ['zzz'] }, // defaultStatus tanimsiz
  ];
  const r = matchEquipmentFeatures({ description: 'aaa bbb ccc' }, rules);
  assert.equal(r.NODEFAULT, 'no');
});

// --- Checkbox otoritesi: zengin checkbox'ta eslesmeyen mappable donanim → "no" ---

const richCheckbox = (extra = []) => [...Array.from({ length: 20 }, (_, i) => `F${i}`), ...extra];

test('matchEquipmentFeatures — checkbox-mappable + zengin checkbox + eslesme yok → no', () => {
  const rules = [{ code: 'X', description: [], features: ['SomeFeature'] }];
  // 20 kalemlik zengin checkbox, X'in token'i yok, aciklama bos → yine de "no"
  assert.equal(matchEquipmentFeatures({ features: richCheckbox() }, rules).X, 'no');
});

test('matchEquipmentFeatures — checkbox-mappable + SPARSE checkbox → unknown (eski fallback korunur)', () => {
  const rules = [{ code: 'X', description: [], features: ['SomeFeature'] }];
  // 3 kalem (<15) → checkbox otoritesi devreye girmez, absence guvenilmez
  assert.equal(matchEquipmentFeatures({ features: ['A', 'B', 'C'] }, rules).X, 'unknown');
});

test('matchEquipmentFeatures — props-mappable + zengin checkbox + props yok → no', () => {
  const rules = [{ code: 'X', description: [], props: { parkingSensors: ['Self-steering systems'] } }];
  const r = matchEquipmentFeatures({ features: richCheckbox(), props: { parkingSensors: 'Rear, Front' } }, rules);
  assert.equal(r.X, 'no');
});

test('matchEquipmentFeatures — props-mappable + zengin checkbox + props VAR → yes', () => {
  const rules = [{ code: 'X', description: [], props: { parkingSensors: ['Self-steering systems'] } }];
  const r = matchEquipmentFeatures({ features: richCheckbox(), props: { parkingSensors: 'Rear, Self-steering systems' } }, rules);
  assert.equal(r.X, 'yes');
});

test('matchEquipmentFeatures — sadece-aciklama kurali zengin checkbox\'a ragmen "no" OLMAZ', () => {
  // features/props yok → checkbox-eslesemez; zengin checkbox onu "no" yapmamali.
  const rules = [{ code: 'X', description: ['zzz'] }];
  const r = matchEquipmentFeatures({ description: 'alakasiz metin', features: richCheckbox() }, rules);
  assert.equal(r.X, 'unknown'); // aciklama bilgilendirici degil → belirsiz kalir
});

test('matchEquipmentFeatures — ALL_DESCRIPTION needs every keyword', () => {
  const rules = [{ code: 'X', matchType: 'ALL_DESCRIPTION', description: ['foo', 'bar'] }];
  assert.equal(matchEquipmentFeatures({ description: 'foo only' }, rules).X, 'unknown');
  assert.equal(matchEquipmentFeatures({ description: 'foo and bar' }, rules).X, 'yes');
});

test('matchEquipmentFeatures — impliedBy promotes child to yes', () => {
  const rules = [
    { code: 'PARENT', description: ['M Sport Paket'] },
    { code: 'CHILD', description: ['nonexistent'], impliedBy: ['M Sport Paket'] },
  ];
  assert.equal(matchEquipmentFeatures({ description: 'mit M Sport Paket' }, rules).CHILD, 'yes');
});

test('matchEquipmentFeatures — dash-tolerant matching', () => {
  const rules = [{ code: 'X', description: ['Head-Up Display'] }];
  assert.equal(matchEquipmentFeatures({ description: 'inkl. Head Up Display' }, rules).X, 'yes');
  assert.equal(matchEquipmentFeatures({ description: 'inkl. Head-Up-Display' }, rules).X, 'yes');
});

// --- DAPRO → S5AUA (gercek EQUIPMENT_RULES.json) ---

test('EQUIPMENT_RULES — S5AUA rule lists the DAPRO abbreviation', () => {
  const s5aua = EQUIPMENT_RULES.find(r => r.code === 'S5AUA');
  assert.ok(s5aua, 'S5AUA rule exists');
  assert.ok(
    s5aua.description.some(d => normalizeText(d) === 'dapro'),
    'S5AUA description includes DAPRO'
  );
});

test('matchEquipmentFeatures — "DAPRO" in description sets S5AUA to yes', () => {
  const r = matchEquipmentFeatures(
    { description: 'BMW M440i, LivePro, Laser, DAPRO, Memory, 360 Kamera' },
    EQUIPMENT_RULES
  );
  assert.equal(r.S5AUA, 'yes');
});

test('matchEquipmentFeatures — full "Driving Assistant Professional" phrase still sets S5AUA to yes', () => {
  const r = matchEquipmentFeatures(
    { description: 'Fahrerassistenzpaket: Driving Assistant Professional, Parkassistent' },
    EQUIPMENT_RULES
  );
  assert.equal(r.S5AUA, 'yes');
});

// --- Fabrika opsiyon kodu eslesmesi (oncelik 0) ---
// C310 (457717928) gercek vakasi: bayi "Laserscheinwerfer (05AZ)" yazmis, kural kalibi
// "Laserlicht" idi → eslesmedi, checkbox otoritesi devreye girip yanlislikla "no" dedi.

test('optionCodeOf — kural kodundan mobile.de opsiyon kodunu turetir', () => {
  assert.equal(optionCodeOf('S5AZA'), '05az');   // Laser Light
  assert.equal(optionCodeOf('S688A'), '0688');   // Harman Kardon
  assert.equal(optionCodeOf('S488A'), '0488');   // Lendenstützen
  assert.equal(optionCodeOf('S2T4A'), '02t4');   // M Sport Diff
  assert.equal(optionCodeOf('S403A'), '0403');   // Sunroof
});

test('optionCodeOf — sentetik/uymayan kodlar icin null', () => {
  assert.equal(optionCodeOf('S5DN_360'), null);
  assert.equal(optionCodeOf('KGNL'), null);
  assert.equal(optionCodeOf(''), null);
  assert.equal(optionCodeOf(), null);
});

test('EQUIPMENT_RULES — her kod ya opsiyon kodu turetir ya da bilinen sentetik koddur', () => {
  const synthetic = ['S5DN_360', 'KGNL'];
  for (const rule of EQUIPMENT_RULES) {
    if (synthetic.includes(rule.code)) continue;
    assert.ok(optionCodeOf(rule.code), `${rule.code} opsiyon kodu turetmeli`);
  }
});

test('matchEquipmentFeatures — parantezli opsiyon kodu → yes (C310 lazer vakasi)', () => {
  const r = matchEquipmentFeatures(
    { description: 'Weitere Ausstattung:\n * Laserscheinwerfer (05AZ)\n * Soundsystem (0688)' },
    EQUIPMENT_RULES
  );
  assert.equal(r.S5AZA, 'yes', 'Laserscheinwerfer (05AZ) → S5AZA yes');
  assert.equal(r.S688A, 'yes', 'Soundsystem (0688) → S688A yes');
});

test('matchEquipmentFeatures — opsiyon kodu, checkbox otoritesinin "no" damgasini ezer', () => {
  // Kapsamli checkbox listesi var ve "Laser headlights" isaretli DEGIL → eskiden "no" olurdu.
  const richCheckbox = Array.from({ length: 20 }, (_, i) => `Feature ${i}`);
  const r = matchEquipmentFeatures(
    { description: 'Laserscheinwerfer (05AZ)', features: richCheckbox },
    EQUIPMENT_RULES
  );
  assert.equal(r.S5AZA, 'yes');
});

test('matchEquipmentFeatures — opsiyon kodu negativeDescription\'i da ezer', () => {
  const rules = [{ code: 'S2VFA', description: ['Adaptives M Fahrwerk'], negativeDescription: ['M Sportfahrwerk'] }];
  const r = matchEquipmentFeatures({ description: 'M Sportfahrwerk, Adaptivfahrwerk (02VF)' }, rules);
  assert.equal(r.S2VFA, 'yes');
});

test('matchEquipmentFeatures — opsiyon kodu daha uzun sayinin ICINDE eslesmez', () => {
  // "0610" (Head-Up Display) telefon numarasindaki "06104"e eslesmemeli.
  // Kisa aciklamada fallback "unknown" olur; onemli olan YANLIS "yes" uretilmemesi.
  const r = matchEquipmentFeatures(
    { description: 'Rufen Sie uns an: 06104 123456. Ausstattung: Klimaanlage' },
    EQUIPMENT_RULES
  );
  assert.notEqual(r.S610A, 'yes');
});

test('matchEquipmentFeatures — opsiyon kodu satir sonunda/basinda da eslesir', () => {
  const rules = [{ code: 'S403A', description: [] }];
  assert.equal(matchEquipmentFeatures({ description: '0403' }, rules).S403A, 'yes');
  assert.equal(matchEquipmentFeatures({ description: 'Schiebedach 0403\nWeiteres' }, rules).S403A, 'yes');
});

// --- C310 vakasinda eklenen serbest-metin varyantlari ---

test('matchEquipmentFeatures — "Adaptives Stoßdämpfungssystem" → S2VFA yes', () => {
  const r = matchEquipmentFeatures({ description: 'Adaptives Stoßdämpfungssystem, Sportfahrwerk' }, EQUIPMENT_RULES);
  assert.equal(r.S2VFA, 'yes');
});

test('matchEquipmentFeatures — "Geschwindigkeitsabhängige Servolenkung" → S216A yes', () => {
  const r = matchEquipmentFeatures({ description: 'Geschwindigkeitsabhängige Servolenkung' }, EQUIPMENT_RULES);
  assert.equal(r.S216A, 'yes');
});

test('matchEquipmentFeatures — duz "Geschwindigkeitsregelanlage" DAP tetiklemez', () => {
  // C310 vakasi: adaptif olmayan duz hiz sabitleyici + serit/carpisma uyaricilari var,
  // ACC yok → S5AUA "no" kalmali. Aciklama bilgilendirici (3+ opsiyon kodu eslesiyor),
  // yani fallback "unknown" degil gercek "no" uretilir.
  const r = matchEquipmentFeatures(
    {
      description: [
        'Weitere Ausstattung:',
        ' * Laserscheinwerfer (05AZ)',
        ' * Soundsystem (0688)',
        ' * Lendenstützen (0488)',
        ' * Geschwindigkeitsregelanlage',
        ' * Spurhalteassistent',
        ' * Kollisionswarnsystem',
        ' * Notbremsassistent',
      ].join('\n'),
    },
    EQUIPMENT_RULES
  );
  assert.equal(r.S5AUA, 'no');
  assert.equal(r.S5AZA, 'yes'); // ayni aciklamada lazer VAR
});

// --- explainEquipmentFeatures: karar gerekceleri (sunroofReason kaynagi) ---
test('explainEquipmentFeatures — her karar yolu gerekce uretir', () => {
  // checkbox otoritesi (C596 vakasi): 39 kalemlik listede Sunroof isaretsiz -> no + gerekce
  const rich = Array.from({ length: 39 }, (_, i) => `Feature ${i}`);
  const r1 = explainEquipmentFeatures({ features: rich }, EQUIPMENT_RULES);
  assert.equal(r1.S403A.status, 'no');
  assert.match(r1.S403A.reason, /checkbox otoritesi: 39/);
  // checkbox isaretli -> yes + gerekce
  const r2 = explainEquipmentFeatures({ features: [...rich, 'Sunroof'] }, EQUIPMENT_RULES);
  assert.equal(r2.S403A.status, 'yes');
  assert.match(r2.S403A.reason, /checkbox/);
  // sinyalsiz -> unknown guvenlik freni
  const r3 = explainEquipmentFeatures({ description: 'kisa pazarlama metni' }, EQUIPMENT_RULES);
  assert.equal(r3.S403A.status, 'unknown');
  assert.match(r3.S403A.reason, /güvenlik freni/);
  // matchEquipmentFeatures ayni statuleri dondurmeli (geri uyum)
  const flat = matchEquipmentFeatures({ features: rich }, EQUIPMENT_RULES);
  assert.equal(flat.S403A, 'no');
});
