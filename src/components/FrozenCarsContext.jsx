import { createContext, useContext, useState } from 'react';

const FrozenCarsContext = createContext(null);

export const FrozenCarsProvider = ({ children, initialIds = [] }) => {
  const [frozenIds, setFrozenIds] = useState(initialIds);

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

export const useFrozenCars = () => useContext(FrozenCarsContext);
