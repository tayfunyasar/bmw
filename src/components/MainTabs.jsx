import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs } from 'antd';
import { yearGroups, sortedYears, allByTotalCost, sortByTotalCost } from '../utils/pricingCalculator';
import { soldGasListings, rwdGasWithSunroofListings, rwdGasWithoutSunroofListings, noSunroofGas, CoupeDieselWithSunroof, cakalListings, kazaliListings } from '../data';
import { useFrozenCars } from './FrozenCarsContext';
import { VehicleTableCard } from './VehicleTableCard';
import { CarTable } from './common/CarTable';
import { CarsWithRecentSubTabs } from './CarsWithRecentSubTabs';
import { computeSuggestedIds } from './Recommendations';
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

  const sorted = useMemo(() => ({
    sold: sortByTotalCost(soldGasListings),
    rwdSunroof: sortByTotalCost(rwdGasWithSunroofListings),
    rwdNoSunroof: sortByTotalCost(rwdGasWithoutSunroofListings),
    noSunroof: sortByTotalCost(noSunroofGas),
    diesel: sortByTotalCost(CoupeDieselWithSunroof),
    cakal: sortByTotalCost(cakalListings),
    kazali: sortByTotalCost(kazaliListings),
  }), []);

  const allCarsById = useMemo(() => {
    const pool = [
      ...allByTotalCost,
      ...sorted.sold,
      ...sorted.rwdSunroof,
      ...sorted.rwdNoSunroof,
      ...sorted.noSunroof,
      ...sorted.diesel,
      ...sorted.cakal,
      ...sorted.kazali,
    ];
    const map = new Map();
    pool.forEach(car => { if (!map.has(car.listingId)) map.set(car.listingId, car); });
    return map;
  }, [sorted]);

  const frozenCars = sortByTotalCost(frozenIds.map(id => allCarsById.get(id)).filter(Boolean));

  const suggestedCars = useMemo(() => {
    const ids = computeSuggestedIds(allByTotalCost);
    return sortByTotalCost(ids.map(id => allCarsById.get(id)).filter(Boolean));
  }, [allCarsById]);

  return (
    <Tabs
      activeKey={currentTab}
      onChange={handleTabChange}
      items={[{
          key: 'frozen',
          label: `📌 Freeze Edilenler — ${frozenCars.length} araç`,
          children: frozenCars.length > 0
            ? <CarTable cars={frozenCars} title="📌 Freeze Edilenler — Yan Yana Karşılaştırma" />
            : <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>Bu görünümde araç yok. Diğer sekmelerde araç başlığındaki 📌 Freeze butonuna tıkla.</div>
        }, {
          key: 'suggested',
          label: `🎯 Önerilen Araçlar — ${suggestedCars.length} araç`,
          children: (
            <CarsWithRecentSubTabs
              cars={suggestedCars}
              recentPool={allByTotalCost}
              baseLabel="Önerilenler"
              titlePrefix="🎯 Önerilenler"
              emptyMessage="Önerilen araç yok."
            />
          )
        }, {
          key: 'all-adjusted',
          label: `💰 TOPLAM MALİYET — ${allByTotalCost.length} araç`,
          children: <CarTable cars={allByTotalCost} title="💰 Tüm Sunroof'lu Araçlar — Toplam Maliyet (Artan)" winningCarIndex={0} />
        }].concat(sortedYears.map(year => {
          const yearlyCars = yearGroups[year];
          const winningCarIndex = yearlyCars.reduce((bestIndex, car, currentIndex) => car.metrics.baseTotalCost < yearlyCars[bestIndex].metrics.baseTotalCost ? currentIndex : bestIndex, 0);

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
          children: <VehicleTableCard carList={sorted.cakal} title="🐺 Çakal Kasalar — Modifiyeli / Şüpheli Araçlar" isRejected={true} rejectedLabel="ÇAKAL" />
        },
        {
          key: 'kazali',
          label: '💥 Kazalı Araçlar',
          children: <VehicleTableCard carList={sorted.kazali} title="�� Kazalı Araçlar — Onarılmış Hasar Kaydı" isRejected={true} rejectedLabel="KAZALI" />
        },
        {
          key: 'sold',
          label: '🚫 Satılan Araçlar',
          children: <VehicleTableCard carList={sorted.sold} title="🚫 Satılan Araçlar" isRejected={true} rejectedLabel="SATILDI" />
        },
        {
          key: 'no-sunroof',
          label: '🚫 Sunroof Yok',
          children: <VehicleTableCard carList={sorted.noSunroof} title="🚫 Sunroof Yok — Red Edilen Araçlar" isRejected={true} rejectedLabel="RED" />
        },
        {
          key: 'rwd-with-sunroof',
          label: '🔙 RWD & Sunroof',
          children: <VehicleTableCard carList={sorted.rwdSunroof} title="🔙 Arkadan İtiş (RWD) & Sunroof — Red Edilen Araçlar" isRejected={true} rejectedLabel="RED (RWD)" />
        },
        {
          key: 'rwd-no-sunroof',
          label: '🔙 RWD & Sunroof Yok',
          children: <VehicleTableCard carList={sorted.rwdNoSunroof} title="🔙 Arkadan İtiş (RWD) & Sunroof Yok — Red Edilen Araçlar" isRejected={true} rejectedLabel="RED (RWD/No Sunroof)" />
        },
        {
          key: 'diesel',
          label: '⛽ Dizel Araçlar & Sunroof',
          children: <VehicleTableCard carList={sorted.diesel} title="⛽ Dizel Araçlar & Sunroof" isRejected={false} />
        }
      ])} 
    />
  );
};
