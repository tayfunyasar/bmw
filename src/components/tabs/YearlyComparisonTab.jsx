import React from 'react';
import { Button } from 'antd';
import { CarTable } from '../common/CarTable';

export const YearlyComparisonTab = ({ year, yearlyCars, winningCarIndex }) => {
  return (
    <CarTable 
      cars={yearlyCars}
      title={`Araç Bilgisi — ${year}`}
      yearLabel={`— ${year}`}
      extraHeaderActions={
        <Button size="small" type="primary" onClick={() => yearlyCars.forEach(car => window.open(car.listingUrl, '_blank'))}>Tüm İlanları Aç</Button>
      }
      winningCarIndex={winningCarIndex}
    />
  );
};
