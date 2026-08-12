import { useState, memo } from 'react';
import { Tabs } from 'antd';
import { sortByTotalCost } from '../utils/pricingCalculator';
import { CarTable } from './common/CarTable';
import { APP } from '../data';
import { getCarPublishedDate } from '../utils/helpers';

const RECENT_DAYS_OPTIONS = APP.recentDaysOptions;

// memo + üstte (MainTabs'ta) referansı sabitlenen cars/recentPool: freeze toggle gibi
// ilgisiz bir üst render, burada buildUnion'ı (ve altındaki dev CarTable'ı) tetiklemesin.
const CarsWithRecentSubTabsComponent = ({ cars, recentPool, baseLabel, titlePrefix, emptyMessage }) => {
  const [activeSubTab, setActiveSubTab] = useState('base');
  const [nowMs] = useState(() => Date.now());

  const buildUnion = (days) => {
    const unionMap = new Map();
    cars.forEach(c => unionMap.set(c.listingId, c));
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
    const result = buildUnion(days);
    const titleSuffix = days == null ? '' : ` + Son ${days} Gün`;
    return result.length > 0
      ? <CarTable cars={result} title={`${titlePrefix}${titleSuffix} — Yan Yana Karşılaştırma`} />
      : <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>{emptyMessage}</div>;
  };

  const subItems = [
    { key: 'base', label: baseLabel, children: renderTab(null) },
    ...RECENT_DAYS_OPTIONS.map(d => ({
      key: `day${d}`,
      label: `${baseLabel} + Son ${d}`,
      children: renderTab(d),
    })),
  ];

  return <Tabs activeKey={activeSubTab} onChange={setActiveSubTab} destroyOnHidden items={subItems} />;
};

export const CarsWithRecentSubTabs = memo(CarsWithRecentSubTabsComponent);
