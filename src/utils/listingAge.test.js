import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listingCreatedAt, listingSoldAt, listingAgeInDays, carListingAgeDays } from './listingAge.js';

const day = 86400000;
const iso = (ms) => new Date(ms).toISOString();

// --- listingCreatedAt: re-list'e dayanikli ilk yayin ---

test('listingCreatedAt — normal kayitta createdTime kazanir (audit sonradir)', () => {
  const car = {
    listingDates: { createdTime: '2026-06-02T10:00:57.000Z' },
    auditHistory: [{ action: 'İlan Eklendi', auditDate: '2026-07-29T10:04:29.155Z' }],
  };
  assert.equal(listingCreatedAt(car), '2026-06-02T10:00:57.000Z');
});

// C729/C1145 vakasi (2026-09-01): bayi ilani kapatip ayni araci yeni ID ile acti;
// mobile.de createdTime 02.06 -> 31.08'e sifirlandi. Audit'teki ilk "İlan Yayınlandı"
// eski tarihi tuttugu icin yas sifirlanmamali (staleness cezasi kacirilmasin).
test('listingCreatedAt — re-list createdTime\'i sifirlasa da eski audit tarihi kazanir (C729 vakasi)', () => {
  const car = {
    listingDates: { createdTime: '2026-08-31T15:26:46.000Z' },   // yeni ilanin ham tarihi
    auditHistory: [
      { action: 'İlan Yayınlandı (mobile.de)', auditDate: '2026-06-02T10:00:57.000Z' },
      { action: 'Yeniden İlan (Re-list)', auditDate: '2026-09-01T15:00:00.000Z' },
    ],
  };
  assert.equal(listingCreatedAt(car), '2026-06-02T10:00:57.000Z');
});

test('listingCreatedAt — listingDates yoksa audit tarihine duser, hicbiri yoksa null', () => {
  const car = { auditHistory: [{ action: 'İlan Yayınlandı (Kullanıcı Teyidi)', auditDate: '2026-03-04T12:00:00.000Z' }] };
  assert.equal(listingCreatedAt(car), '2026-03-04T12:00:00.000Z');
  assert.equal(listingCreatedAt({}), null);
});

// --- listingSoldAt + yas sayacinin durmasi ---

test('listingSoldAt — ilk satis audit\'i, yoksa null', () => {
  const car = { auditHistory: [
    { action: 'Aktif → Satılan', auditDate: '2026-03-14T12:00:00.000Z' },
    { action: 'İlan Satıldı', auditDate: '2026-03-14T12:00:00.000Z' },
  ] };
  assert.equal(listingSoldAt(car), '2026-03-14T12:00:00.000Z');
  assert.equal(listingSoldAt({ auditHistory: [{ action: 'İlan Eklendi', auditDate: '2026-01-01T00:00:00.000Z' }] }), null);
});

// C45 vakasi (2026-09-01): tabloda "10 günde satıldı" yazarken skor tooltip'i
// "181 gündür yayında → −20" diyordu; sayac satilan ilanda BUGUNE kadar isliyordu.
test('carListingAgeDays — satilan ilanda sayac satis tarihinde durur (C45 vakasi)', () => {
  const car = {
    auditHistory: [
      { action: 'İlan Yayınlandı (Kullanıcı Teyidi)', auditDate: '2026-03-04T12:00:00.000Z' },
      { action: 'İlan Satıldı', auditDate: '2026-03-14T12:00:00.000Z' },
    ],
  };
  assert.equal(carListingAgeDays(car), 10);
});

test('carListingAgeDays — aktif ilanda sayac bugune kadar isler', () => {
  const car = { listingDates: { createdTime: iso(Date.now() - 12 * day) } };
  assert.equal(carListingAgeDays(car), 12);
});

test('listingAgeInDays — endTime verilmezse bugun; createdTime yoksa/bozuksa null', () => {
  assert.equal(listingAgeInDays(iso(Date.now() - 3 * day)), 3);
  assert.equal(listingAgeInDays('2026-01-01T00:00:00.000Z', '2026-01-11T00:00:00.000Z'), 10);
  assert.equal(listingAgeInDays(null), null);
  assert.equal(listingAgeInDays('bozuk-tarih'), null);
});

test('listingAgeInDays — satis tarihi yayindan onceyse negatife dusmez (0)', () => {
  assert.equal(listingAgeInDays('2026-03-14T12:00:00.000Z', '2026-03-04T12:00:00.000Z'), 0);
});
