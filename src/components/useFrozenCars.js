import { useSyncExternalStore } from 'react';

// Modül seviyeli paylaşılan store (React Context DEĞİL) — Context'in "değer değişince
// TÜM tüketiciler render olur" sorununu çözer (bir aracı freeze etmek onlarca
// FreezeButton'ı birden render ediyordu). useSyncExternalStore + kararlı snapshot:
// yalnız TAKİP EDİLEN değer gerçekten değiştiğinde o bileşen render olur.
const STORAGE_KEY = 'bmw.favorites.v1';

const loadInitial = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage yoksa/bozuksa boş başla */ }
  return [];
};

let frozenIds = loadInitial();
let frozenSet = new Set(frozenIds);
const listeners = new Set();

const persist = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(frozenIds)); } catch { /* yok say */ }
};

const setFrozen = (nextSet) => {
  frozenSet = nextSet;
  frozenIds = [...nextSet];
  persist();
  listeners.forEach(listener => listener());
};

export const toggleFrozen = (listingId) => {
  const next = new Set(frozenSet);
  if (next.has(listingId)) next.delete(listingId); else next.add(listingId);
  setFrozen(next);
};

export const freezeMany = (listingIds) => {
  const next = new Set(frozenSet);
  listingIds.forEach(id => next.add(id));
  setFrozen(next);
};

export const clearFrozen = () => setFrozen(new Set());

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Tek bir aracın freeze durumu — yalnızca O aracın durumu değişince re-render eder;
// başka bir aracı freeze etmek bu bileşeni ETKİLEMEZ.
export const useIsFrozen = (listingId) => useSyncExternalStore(subscribe, () => frozenSet.has(listingId));

// Tüm freeze edilen id listesi — referansı yalnızca liste gerçekten değişince yenilenir.
export const useFrozenIds = () => useSyncExternalStore(subscribe, () => frozenIds);
