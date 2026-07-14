import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchEquipmentFeatures, normalizeText } from './equipment-match.js';

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
