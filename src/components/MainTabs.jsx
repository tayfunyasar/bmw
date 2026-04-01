import React from 'react';
import { Tabs } from 'antd';
import { yearGroups, sortedYears } from '../utils/pricingCalculator';
import { soldGasListings, rwdGasWithSunroofListings, rwdGasWithoutSunroofListings, noSunroofGas, CoupeDieselWithSunroof } from '../data';
import { VehicleTableCard } from './VehicleTableCard';
import { YearlyComparisonTab } from './tabs/YearlyComparisonTab';
import { RulesTab } from './tabs/RulesTab';
import { BookmarksTab } from './tabs/BookmarksTab';
import { NotesTab } from './tabs/NotesTab';
import { DeletedCarsTab } from './tabs/DeletedCarsTab';

export const MainTabs = () => {
  return (
    <Tabs
      defaultActiveKey={sortedYears[0]}
      items={sortedYears.map(year => {
          const yearlyCars = yearGroups[year];
          const winningCarIndex = yearlyCars.reduce((bestIndex, car, currentIndex) => car.metrics.adjustedCost < yearlyCars[bestIndex].metrics.adjustedCost ? currentIndex : bestIndex, 0);

          return {
            key: year,
            label: `📅 ${year} MODEL YILI — ${yearlyCars.length} araç`,
            children: <YearlyComparisonTab year={year} yearlyCars={yearlyCars} winningCarIndex={winningCarIndex} />
          };
        }).concat([
        {
          key: 'bookmarks',
          label: '🔖 Siteler & Bookmarklar',
          children: <BookmarksTab />
        },
        {
          key: 'notes',
          label: '📝 Notlar & Aksiyonlar',
          children: <NotesTab />
        },
        {
          key: 'rules',
          label: '📋 Kurallar & Metodoloji',
          children: <RulesTab />
        },
        {
          key: 'deleted',
          label: '🗑️ Silinen Araçlar',
          children: <DeletedCarsTab />
        },
        {
          key: 'sold',
          label: '🚫 Satılan Araçlar',
          children: <VehicleTableCard carList={soldGasListings} title="🚫 Satılan Araçlar" isRejected={true} rejectedLabel="SATILDI" />
        },
        {
          key: 'no-sunroof',
          label: '🚫 Sunroof Yok',
          children: <VehicleTableCard carList={noSunroofGas} title="🚫 Sunroof Yok — Red Edilen Araçlar" isRejected={true} rejectedLabel="RED" />
        },
        {
          key: 'rwd-with-sunroof',
          label: '🔙 RWD & Sunroof',
          children: <VehicleTableCard carList={rwdGasWithSunroofListings} title="🔙 Arkadan İtiş (RWD) & Sunroof — Red Edilen Araçlar" isRejected={true} rejectedLabel="RED (RWD)" />
        },
        {
          key: 'rwd-no-sunroof',
          label: '🔙 RWD & Sunroof Yok',
          children: <VehicleTableCard carList={rwdGasWithoutSunroofListings} title="🔙 Arkadan İtiş (RWD) & Sunroof Yok — Red Edilen Araçlar" isRejected={true} rejectedLabel="RED (RWD/No Sunroof)" />
        },
        {
          key: 'diesel',
          label: '⛽ Dizel Araçlar & Sunroof',
          children: <VehicleTableCard carList={CoupeDieselWithSunroof} title="⛽ Dizel Araçlar & Sunroof" isRejected={false} />
        }
      ])} 
    />
  );
};
