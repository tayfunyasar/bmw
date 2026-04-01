import React from 'react';
import { CarTable } from './common/CarTable';

export const VehicleTableCard = ({ carList, title, isRejected = false, rejectedLabel = 'RED' }) => {
  return (
    <CarTable 
      cars={carList} 
      title={title} 
      isRejected={isRejected} 
      rejectedLabel={rejectedLabel} 
    />
  );
};
