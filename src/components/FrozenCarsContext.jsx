import { createContext, useContext, useState } from 'react';

const FrozenCarsContext = createContext(null);

export const FrozenCarsProvider = ({ children }) => {
  const [frozenIds, setFrozenIds] = useState([]);

  const toggle = (listingId) => {
    setFrozenIds(prev => prev.includes(listingId)
      ? prev.filter(id => id !== listingId)
      : [...prev, listingId]);
  };

  const clear = () => setFrozenIds([]);

  return (
    <FrozenCarsContext.Provider value={{ frozenIds, toggle, clear }}>
      {children}
    </FrozenCarsContext.Provider>
  );
};

export const useFrozenCars = () => useContext(FrozenCarsContext);
