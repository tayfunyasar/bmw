import React, { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs } from 'antd';
import { yearGroups, sortedYears, allByTotalCost, sortByTotalCost } from '../utils/pricingCalculator';
import { soldGasListings, rwdSoldWithSunroofListings, rwdSoldWithoutSunroofListings, rwdGasWithSunroofListings, rwdGasWithoutSunroofListings, noSunroofGas, CoupeDieselWithSunroof, cakalListings, kazaliListings } from '../data';
import { carMatchesFilters } from '../utils/carFilters';
import { FrozenTab, FrozenTabLabel } from './tabs/FrozenTab';
import { VehicleTableCard } from './VehicleTableCard';
import { CarTable } from './common/CarTable';
import { CarsWithRecentSubTabs } from './CarsWithRecentSubTabs';
import { computeSuggestedIds } from '../utils/recommendations';
import { YearlyComparisonTab } from './tabs/YearlyComparisonTab';
import { RulesTab } from './tabs/RulesTab';
import { BookmarksTab } from './tabs/BookmarksTab';
import { NotesTab } from './tabs/NotesTab';
import { DeletedCarsTab } from './tabs/DeletedCarsTab';

const DEAL = (c) => c.metrics.expectedDealScore ?? c.metrics.personalDealScore;
const SORTERS = {
  price: (a, b) => a.metrics.baseTotalCost - b.metrics.baseTotalCost,
  deal:  (a, b) => DEAL(a) - DEAL(b),
  km:    (a, b) => (a.mileageKm || 0) - (b.mileageKm || 0),
  score: (a, b) => (b.totalScore || 0) - (a.totalScore || 0),
};

export const MainTabs = ({ showDisliked = false, sortKey = 'price', budgetMax = 0, kmMax = 0, lciOnly = false, twoStarSure = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentTab = location.pathname.replace('/', '') || 'all-adjusted';

  // Filtreler (carFilters — TEK kaynak: renk/km/bütçe/lci) + seçilen sıralama; tüm ana havuzlara
  // tek noktadan. useCallback: kimliği yalnızca gerçek girdileri değişince yenilenir — freeze
  // toggle gibi ilgisiz bir render bunu etkilemez, visibleAll/yearlyArranged yeniden hesaplanmaz.
  const arrange = useCallback((list) => {
    const r = sortByTotalCost(list).filter(c => carMatchesFilters(c, { showDisliked, kmMax, budgetMax, lciOnly, twoStarSure }));
    return sortKey === 'price' ? r : [...r].sort(SORTERS[sortKey] || SORTERS.price);
  }, [showDisliked, budgetMax, kmMax, lciOnly, twoStarSure, sortKey]);
  const visibleAll = useMemo(() => arrange(allByTotalCost), [arrange]);
  const yearlyArranged = useMemo(() => {
    const map = {};
    sortedYears.forEach(year => { map[year] = arrange(yearGroups[year]); });
    return map;
  }, [arrange]);

  const handleTabChange = (key) => {
    // Filtreler query'de tutulur — tab değişince kaybolmasın diye search korunur.
    navigate({ pathname: `/${key}`, search: location.search });
  };

  const sorted = useMemo(() => ({
    // SOLD sekmesi tüm satılmışları gösterir (xDrive + RWD); dosyalar ayrık, görünüm birleşik.
    sold: sortByTotalCost([...soldGasListings, ...rwdSoldWithSunroofListings, ...rwdSoldWithoutSunroofListings]),
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

  const suggestedCars = useMemo(() => {
    const ids = computeSuggestedIds(visibleAll);
    return sortByTotalCost(ids.map(id => allCarsById.get(id)).filter(Boolean));
  }, [allCarsById, visibleAll]);

  return (
    <Tabs
      activeKey={currentTab}
      onChange={handleTabChange}
      destroyOnHidden
      items={[{
          key: 'frozen',
          label: <FrozenTabLabel allCarsById={allCarsById} />,
          children: <FrozenTab allCarsById={allCarsById} />
        }, {
          key: 'suggested',
          label: `🎯 Önerilen Araçlar — ${suggestedCars.length} araç`,
          children: (
            <CarsWithRecentSubTabs
              cars={suggestedCars}
              recentPool={visibleAll}
              baseLabel="Önerilenler"
              titlePrefix="🎯 Önerilenler"
              emptyMessage="Önerilen araç yok."
            />
          )
        }, {
          key: 'all-adjusted',
          label: `💰 TOPLAM MALİYET — ${visibleAll.length} araç`,
          children: <CarTable cars={visibleAll} title="💰 Tüm Sunroof'lu Araçlar — Toplam Maliyet (Artan)" winningCarIndex={0} />
        }].concat(sortedYears.map(year => {
          const yearlyCars = yearlyArranged[year];
          if (yearlyCars.length === 0) return null;
          const winningCarIndex = yearlyCars.reduce((bestIndex, car, currentIndex) => car.metrics.baseTotalCost < yearlyCars[bestIndex].metrics.baseTotalCost ? currentIndex : bestIndex, 0);

          return {
            key: year,
            label: `📅 ${year} MODEL YILI — ${yearlyCars.length} araç`,
            children: <YearlyComparisonTab year={year} yearlyCars={yearlyCars} winningCarIndex={winningCarIndex} />
          };
        }).filter(Boolean)).concat([
        {
          key: 'bilgi',
          label: '📚 Bilgi & Kurallar',
          children: <Tabs destroyOnHidden items={[
            { key: 'bookmarks', label: '🔖 Bookmarklar', children: <BookmarksTab /> },
            { key: 'notes', label: '📝 Notlar', children: <NotesTab /> },
            { key: 'rules', label: '📋 Kurallar', children: <RulesTab /> },
          ]} />
        },
        {
          key: 'elenenler',
          label: '🚫 Elenenler',
          children: <Tabs destroyOnHidden items={[
            { key: 'sold', label: `🚫 Satılan (${sorted.sold.length})`, children: <VehicleTableCard carList={sorted.sold} title="🚫 Satılan Araçlar" isRejected rejectedLabel="SATILDI" /> },
            { key: 'cakal', label: `🐺 Çakal (${sorted.cakal.length})`, children: <VehicleTableCard carList={sorted.cakal} title="🐺 Çakal Kasalar — Modifiyeli / Şüpheli" isRejected rejectedLabel="ÇAKAL" /> },
            { key: 'kazali', label: `💥 Kazalı (${sorted.kazali.length})`, children: <VehicleTableCard carList={sorted.kazali} title="💥 Kazalı Araçlar — Onarılmış Hasar" isRejected rejectedLabel="KAZALI" /> },
            { key: 'no-sunroof', label: `🚫 Sunroof Yok (${sorted.noSunroof.length})`, children: <VehicleTableCard carList={sorted.noSunroof} title="🚫 Sunroof Yok" isRejected rejectedLabel="RED" /> },
            { key: 'rwd-sr', label: `🔙 RWD+SR (${sorted.rwdSunroof.length})`, children: <VehicleTableCard carList={sorted.rwdSunroof} title="🔙 RWD & Sunroof" isRejected rejectedLabel="RED (RWD)" /> },
            { key: 'rwd-nsr', label: `🔙 RWD (${sorted.rwdNoSunroof.length})`, children: <VehicleTableCard carList={sorted.rwdNoSunroof} title="🔙 RWD & Sunroof Yok" isRejected rejectedLabel="RED (RWD)" /> },
            { key: 'diesel', label: `⛽ Dizel (${sorted.diesel.length})`, children: <VehicleTableCard carList={sorted.diesel} title="⛽ Dizel Araçlar & Sunroof" /> },
            { key: 'deleted', label: '🗑️ Silinen', children: <DeletedCarsTab /> },
          ]} />
        },
      ])}
    />
  );
};
