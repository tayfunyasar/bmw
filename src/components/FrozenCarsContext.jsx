import { useState, useEffect } from 'react';
import { FrozenCarsContext } from './useFrozenCars';

const STORAGE_KEY = 'bmw.favorites.v1';

// Favoriler kalıcı: tarayıcıda saklanır, sayfa yenilenince/kapanınca kaybolmaz.
const loadFavorites = (fallback) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage yoksa/bozuksa fallback */ }
  return fallback;
};

export const FrozenCarsProvider = ({ children, initialIds = [] }) => {
  const [frozenIds, setFrozenIds] = useState(() => loadFavorites(initialIds));

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(frozenIds)); } catch { /* yok say */ }
  }, [frozenIds]);

  const toggle = (listingId) => {
    setFrozenIds(prev => prev.includes(listingId)
      ? prev.filter(id => id !== listingId)
      : [...prev, listingId]);
  };

  const freezeMany = (listingIds) => {
    setFrozenIds(prev => {
      const set = new Set(prev);
      listingIds.forEach(id => set.add(id));
      return [...set];
    });
  };

  const clear = () => setFrozenIds([]);

  return (
    <FrozenCarsContext.Provider value={{ frozenIds, toggle, freezeMany, clear }}>
      {children}
    </FrozenCarsContext.Provider>
  );
};
