import React, { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs } from 'antd';
import { yearGroups, sortedYears, allByTotalCost, sortByTotalCost } from '../utils/pricingCalculator';
import { soldGasListings, rwdSoldWithSunroofListings, rwdSoldWithoutSunroofListings, rwdGasWithSunroofListings, rwdGasWithoutSunroofListings, noSunroofGas, CoupeDieselWithSunroof, cakalListings, kazaliListings } from '../data';
import { carMatchesFilters } from '../utils/carFilters';
import { getCarPublishedDate } from '../utils/helpers';
import { emails } from '../data';
import { FrozenTab, FrozenTabLabel } from './tabs/FrozenTab';
import { CarTable } from './common/CarTable';
import { CarsWithRecentSubTabs } from './CarsWithRecentSubTabs';
import { TabLabel } from './common/TabLabel';
import { computeSuggestedIds } from '../utils/recommendations';
import { YearlyComparisonTab } from './tabs/YearlyComparisonTab';
import { RulesTab } from './tabs/RulesTab';
import { BookmarksTab } from './tabs/BookmarksTab';
import { NotesTab } from './tabs/NotesTab';
import { EmailsTab } from './tabs/EmailsTab';

const DEAL = (c) => c.metrics.expectedDealScore ?? c.metrics.personalDealScore;
const SORTERS = {
  price: (a, b) => a.metrics.baseTotalCost - b.metrics.baseTotalCost,
  deal:  (a, b) => DEAL(a) - DEAL(b),
  km:    (a, b) => (a.mileageKm || 0) - (b.mileageKm || 0),
  date:  (a, b) => (getCarPublishedDate(b)?.getTime() || 0) - (getCarPublishedDate(a)?.getTime() || 0),
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

  // --- Sekme ağacı: 4 üst grup, her biri kendi alt sekmeleriyle -------------
  // URL DAİMA yaprak anahtarını taşır (/suggested, /2023, /sold ...) — eski
  // derin linkler ve paylaşılan filtreli adresler kırılmaz. Üst grup, yaprağın
  // hangi gruba ait olduğundan TÜRETİLİR, ayrıca URL'ye yazılmaz.
  const yearItems = sortedYears
    .filter(year => yearlyArranged[year].length > 0)
    .map(year => {
      const yearlyCars = yearlyArranged[year];
      const winningCarIndex = yearlyCars.reduce((best, car, i) => car.metrics.baseTotalCost < yearlyCars[best].metrics.baseTotalCost ? i : best, 0);
      // firstRegistrationYearAndMonth[0] null olabiliyor → "null MODEL YILI" yerine anlamlı etiket.
      const known = year !== 'null' && year !== 'undefined';
      return {
        key: year,
        sortWeight: known ? Number(year) : -Infinity,   // bilinmeyen en sona
        carCount: yearlyCars.length,
        label: <TabLabel icon={known ? undefined : '❓'} count={yearlyCars.length}>{known ? year : 'Bilinmiyor'}</TabLabel>,
        children: <YearlyComparisonTab year={year} yearlyCars={yearlyCars} winningCarIndex={winningCarIndex} />,
      };
    })
    .sort((a, b) => b.sortWeight - a.sortWeight);


  const GROUPS = [
    {
      key: 'pool', icon: '🎯', label: 'Alım Havuzu', count: visibleAll.length,
      items: [
        { key: 'suggested', label: <TabLabel icon="⭐" count={suggestedCars.length}>Önerilenler</TabLabel>,
          children: <CarsWithRecentSubTabs cars={suggestedCars} recentPool={visibleAll} baseLabel="Önerilenler" titlePrefix="🎯 Önerilenler" emptyMessage="Önerilen araç yok." /> },
        { key: 'all-adjusted', label: <TabLabel icon="💰" count={visibleAll.length}>Toplam maliyet</TabLabel>,
          children: <CarTable cars={visibleAll} title="💰 Tüm Sunroof'lu Araçlar — Toplam Maliyet (Artan)" winningCarIndex={0} /> },
        { key: 'frozen', label: <FrozenTabLabel allCarsById={allCarsById} />, children: <FrozenTab allCarsById={allCarsById} /> },
      ],
    },
    { key: 'years', icon: '📅', label: 'Model yılı', count: yearItems.reduce((s, i) => s + i.carCount, 0),
      items: yearItems },
    {
      key: 'info', icon: '📚', label: 'Bilgi',
      items: [
        { key: 'bookmarks', label: <TabLabel icon="🔖">Bookmarklar</TabLabel>, children: <BookmarksTab /> },
        { key: 'notes', label: <TabLabel icon="📝">Notlar</TabLabel>, children: <NotesTab /> },
        { key: 'emails', label: <TabLabel icon="📧" count={emails.emails.length}>Mailler</TabLabel>, children: <EmailsTab /> },
        { key: 'rules', label: <TabLabel icon="📋">Kurallar</TabLabel>, children: <RulesTab /> },
      ],
    },
  ];

  // Yaprak → grup eşlemesi; bilinmeyen adres alım havuzuna düşer.
  const activeGroup = GROUPS.find(g => g.items.some(i => i.key === currentTab)) || GROUPS[0];
  const activeLeaf = activeGroup.items.some(i => i.key === currentTab) ? currentTab : activeGroup.items[0].key;

  return (
    <Tabs
      activeKey={activeGroup.key}
      onChange={key => handleTabChange((GROUPS.find(g => g.key === key) || GROUPS[0]).items[0].key)}
      destroyOnHidden
      items={GROUPS.map(group => ({
        key: group.key,
        label: <TabLabel icon={group.icon} count={group.count} tone="accent">{group.label}</TabLabel>,
        children: (
          <Tabs
            activeKey={activeLeaf}
            onChange={handleTabChange}
            destroyOnHidden
            size="small"
            items={group.items}
          />
        ),
      }))}
    />
  );
};
