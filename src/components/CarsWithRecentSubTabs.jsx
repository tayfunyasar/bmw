import { useState } from 'react';
import { Tabs } from 'antd';
import { sortByTotalCost } from '../utils/pricingCalculator';
import { CarTable } from './common/CarTable';

const RECENT_DAYS_OPTIONS = [1, 3, 7, 14, 30];

const getCarPublishedDate = (car) => {
  const published = car.auditHistory?.find(h => h.action?.includes('İlan Yayınlandı'));
  const raw = car.listingDates?.createdTime || published?.auditDate;
  return raw ? new Date(raw) : null;
};

export const CarsWithRecentSubTabs = ({ cars, recentPool, baseLabel, titlePrefix, emptyMessage }) => {
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

  return <Tabs activeKey={activeSubTab} onChange={setActiveSubTab} items={subItems} />;
};
