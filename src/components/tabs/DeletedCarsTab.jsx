import React from 'react';
import { Space } from 'antd';
import { deletedCars, granCoupe as granCoupeCars } from '../../data';
import { VehicleTableCard } from '../VehicleTableCard';

export const DeletedCarsTab = () => {
  return (
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      <VehicleTableCard 
        carList={deletedCars} 
        title="🗑️ Silinen Araçlar" 
        isRejected={true} 
        rejectedLabel="SİLİNDİ" 
      />

      <VehicleTableCard 
        carList={granCoupeCars} 
        title="🚪 Gran Coupé (G26) — Red Edilen Araçlar" 
        isRejected={true} 
        rejectedLabel="RED (G26)" 
      />
    </Space>
  );
};
