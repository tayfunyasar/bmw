import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs } from 'antd';
import { yearGroups, sortedYears, allByTotalCost, sortByTotalCost } from '../utils/pricingCalculator';
import { soldGasListings, rwdGasWithSunroofListings, rwdGasWithoutSunroofListings, noSunroofGas, CoupeDieselWithSunroof, cakalListings, kazaliListings } from '../data';
import { useFrozenCars } from './FrozenCarsContext';
import { VehicleTableCard } from './VehicleTableCard';
import { CarTable } from './common/CarTable';
import { YearlyComparisonTab } from './tabs/YearlyComparisonTab';
import { RulesTab } from './tabs/RulesTab';
import { BookmarksTab } from './tabs/BookmarksTab';
import { NotesTab } from './tabs/NotesTab';
import { DeletedCarsTab } from './tabs/DeletedCarsTab';

const RECENT_DAYS_OPTIONS = [1, 3, 7, 14, 30];

const getCarPublishedDate = (car) => {
  const published = car.auditHistory?.find(h => h.action?.includes('İlan Yayınlandı'));
  const raw = car.listingDates?.createdTime || published?.auditDate;
  return raw ? new Date(raw) : null;
};

const EmptyFrozen = () => (
  <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>
    Bu görünümde araç yok. Diğer sekmelerde araç başlığındaki 📌 Freeze butonuna tıkla.
  </div>
);

const FrozenTabContent = ({ frozenCars, recentPool }) => {
  const [activeSubTab, setActiveSubTab] = useState('suggested');
  const [nowMs] = useState(() => Date.now());

  const buildUnion = (days) => {
    const unionMap = new Map();
    frozenCars.forEach(c => unionMap.set(c.listingId, c));
    if (days != null) {
      const cutoff = nowMs - days * 86400000;
      recentPool.forEach(car => {
        const date = getCarPublishedDate(car);
        if (date && date.getTime() >= cutoff) unionMap.set(car.listingId, car);
      });
    }
    return sortByTotalCost([...unionMap.values()]);
  };

  const renderTab = (days) => {
    const cars = buildUnion(days);
    const titleSuffix = days == null ? '' : ` + Son ${days} Gün`;
    return cars.length > 0
      ? <CarTable cars={cars} title={`📌 Önerilenler${titleSuffix} — Yan Yana Karşılaştırma`} />
      : <EmptyFrozen />;
  };

  const subItems = [
    { key: 'suggested', label: 'Önerilenler', children: renderTab(null) },
    ...RECENT_DAYS_OPTIONS.map(d => ({
      key: `day${d}`,
      label: `Önerilenler + Son ${d}`,
      children: renderTab(d),
    })),
  ];

  return <Tabs activeKey={activeSubTab} onChange={setActiveSubTab} items={subItems} />;
};

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

  return (
    <Tabs
      activeKey={currentTab}
      onChange={handleTabChange}
      items={[{
          key: 'frozen',
          label: `📌 Freeze Edilenler — ${frozenCars.length} araç`,
          children: <FrozenTabContent frozenCars={frozenCars} recentPool={allByTotalCost} />
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
