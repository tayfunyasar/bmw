import { createContext, useContext } from 'react';

// Context + hook bilerek component'siz ayrı dosyada:
// react-refresh/only-export-components kuralı component dosyasından
// hook export edilmesine izin vermiyor (Fast Refresh bozulur).
export const FrozenCarsContext = createContext(null);

export const useFrozenCars = () => useContext(FrozenCarsContext);
