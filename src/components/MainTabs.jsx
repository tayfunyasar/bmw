import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs } from 'antd';
import { yearGroups, sortedYears, allByTotalCost } from '../utils/pricingCalculator';
import { soldGasListings, rwdGasWithSunroofListings, rwdGasWithoutSunroofListings, noSunroofGas, CoupeDieselWithSunroof, cakalListings, kazaliListings } from '../data';
import { useFrozenCars } from './FrozenCarsContext';
import { VehicleTableCard } from './VehicleTableCard';
import { CarTable } from './common/CarTable';
import { YearlyComparisonTab } from './tabs/YearlyComparisonTab';
import { RulesTab } from './tabs/RulesTab';
import { BookmarksTab } from './tabs/BookmarksTab';
import { NotesTab } from './tabs/NotesTab';
import { DeletedCarsTab } from './tabs/DeletedCarsTab';

export const MainTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentTab = location.pathname.replace('/', '') || 'all-adjusted';
  const { frozenIds } = useFrozenCars();

  const handleTabChange = (key) => {
    navigate(`/${key}`);
  };

  const allCarsById = useMemo(() => {
    const pool = [
      ...allByTotalCost,
      ...soldGasListings,
      ...rwdGasWithSunroofListings,
      ...rwdGasWithoutSunroofListings,
      ...noSunroofGas,
      ...CoupeDieselWithSunroof,
      ...cakalListings,
      ...kazaliListings,
    ];
    const map = new Map();
    pool.forEach(car => { if (!map.has(car.listingId)) map.set(car.listingId, car); });
    return map;
  }, []);

  const frozenCars = frozenIds.map(id => allCarsById.get(id)).filter(Boolean);

  return (
    <Tabs
      activeKey={currentTab}
      onChange={handleTabChange}
      items={[{
          key: 'frozen',
          label: `📌 Freeze Edilenler — ${frozenCars.length} araç`,
          children: frozenCars.length > 0
            ? <CarTable cars={frozenCars} title="📌 Freeze Edilen Araçlar — Yan Yana Karşılaştırma" />
            : <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Henüz freeze edilmiş araç yok. Diğer sekmelerde araç başlığındaki 📌 Freeze butonuna tıkla.</div>
        }, {
          key: 'all-adjusted',
          label: `💰 TOPLAM MALİYET — ${allByTotalCost.length} araç`,
          children: <CarTable cars={allByTotalCost} title="💰 Tüm Sunroof'lu Araçlar — Toplam Maliyet (Artan)" winningCarIndex={0} />
        }].concat(sortedYears.map(year => {
          const yearlyCars = yearGroups[year];
          const winningCarIndex = yearlyCars.reduce((bestIndex, car, currentIndex) => car.metrics.adjustedCost < yearlyCars[bestIndex].metrics.adjustedCost ? currentIndex : bestIndex, 0);

          return {
            key: year,
            label: `📅 ${year} MODEL YILI — ${yearlyCars.length} araç`,
            children: <YearlyComparisonTab year={year} yearlyCars={yearlyCars} winningCarIndex={winningCarIndex} />
          };
        })).concat([
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
          key: 'cakal',
          label: '🐺 Çakal Kasalar',
          children: <VehicleTableCard carList={cakalListings} title="🐺 Çakal Kasalar — Modifiyeli / Şüpheli Araçlar" isRejected={true} rejectedLabel="ÇAKAL" />
        },
        {
          key: 'kazali',
          label: '💥 Kazalı Araçlar',
          children: <VehicleTableCard carList={kazaliListings} title="�� Kazalı Araçlar — Onarılmış Hasar Kaydı" isRejected={true} rejectedLabel="KAZALI" />
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
