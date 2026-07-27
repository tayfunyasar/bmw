import React from 'react';
import { CarTable } from '../common/CarTable';
import { useFrozenIds } from '../useFrozenCars';
import { sortByTotalCost } from '../../utils/pricingCalculator';

// frozenIds burada okunur (MainTabs'ta değil) — böylece bir freeze/unfreeze tıklaması
// yalnızca bu küçük sekme etiketini/içeriğini render eder, MainTabs'ın koca items
// dizisini (ve aktif sekmenin dev CarTable'ını) DEĞİL.
const useFrozenCarList = (allCarsById) => {
  const frozenIds = useFrozenIds();
  return sortByTotalCost(frozenIds.map(id => allCarsById.get(id)).filter(Boolean));
};

export const FrozenTabLabel = ({ allCarsById }) => {
  const frozenCars = useFrozenCarList(allCarsById);
  return <>📌 Freeze Edilenler — {frozenCars.length} araç</>;
};

export const FrozenTab = ({ allCarsById }) => {
  const frozenCars = useFrozenCarList(allCarsById);
  return frozenCars.length > 0
    ? <CarTable cars={frozenCars} title="📌 Freeze Edilenler — Yan Yana Karşılaştırma" />
    : <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Bu görünümde araç yok. Diğer sekmelerde araç başlığındaki 📌 Freeze butonuna tıkla.</div>;
};
