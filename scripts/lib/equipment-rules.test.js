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

test('matchEquipmentFeatures — no signal → unknown', () => {
  const rules = [{ code: 'X', description: ['ABC'], features: ['F'] }];
  assert.equal(matchEquipmentFeatures({ description: 'nothing here' }, rules).X, 'unknown');
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
