import React from 'react';
import { Card, Flex, Typography, Tooltip } from 'antd';
import { CATEGORIES, TIERS, rankPicks } from '../utils/recommendations';
import { listingAgeInDays } from '../utils/pricingCalculator';

const { Text, Link } = Typography;

const formatDelta = (d) => (d > 0 ? `+${d}` : `${d}`);
const formatScore = (n) => (typeof n === 'number' ? Math.round(n * 10) / 10 : n);

// İlan yaşı rozeti: yeni (≤5g) yeşil, orta sarı, bayat (≥30g) kırmızı. Staleness cezası ile hizalı.
const ageBadge = (days) => {
  if (days == null) return null;
  const color = days <= 5 ? '#52c41a' : days < 30 ? '#d4a017' : '#ff4d4f';
  const label = days <= 5 ? `🆕 ${days} gün` : `🕐 ${days} gün`;
  return <Text style={{ fontSize: '11px', color, fontWeight: 600 }}>{label}</Text>;
};

const ScoreBreakdown = ({ breakdown, total }) => (
  <Flex vertical gap={3} style={{ fontSize: '11px', textAlign: 'left', width: 210, maxWidth: '78vw', wordBreak: 'break-word' }}>
    <Text style={{ color: '#bbb', fontSize: '10px' }}>Toplam skor nasıl hesaplandı (0-1 × ağırlık):</Text>
    {breakdown.map((b, i) => (
      <Flex key={i} vertical gap={0}>
        <Flex justify="space-between" gap={10}>
          <Text style={{ color: '#eee' }}>{b.label}</Text>
          <Text strong style={{ color: b.delta >= 0 ? '#52c41a' : '#ff4d4f', whiteSpace: 'nowrap' }}>{formatDelta(b.delta)}</Text>
        </Flex>
        {b.formula ? <Text style={{ color: '#999', fontSize: '10px' }}>{b.formula}</Text> : null}
      </Flex>
    ))}
    {total != null && (
      <Flex justify="space-between" gap={10} style={{ borderTop: '1px solid #555', paddingTop: 3, marginTop: 2 }}>
        <Text strong style={{ color: '#fff' }}>TOPLAM (0-100)</Text>
        <Text strong style={{ color: '#fff' }}>{formatScore(total)} / 100</Text>
      </Flex>
    )}
  </Flex>
);

const RankedPick = ({ car, rank, category }) => {
  const sold = !!car.isSold;
  const danger = sold ? { type: 'danger' } : {};
  const score = category.scoreOf(car);
  const maxScore = category.maxScoreOf?.(car);
  const showBreakdown = category.scoreLabel !== 'Donanım skoru';
  return (
    <Card
      hoverable
      type="inner"
      size="small"
      // Yatay scroll satırında kartlar sıkışmasın: sabit genişlik + shrink kapalı.
      style={{ flex: '0 0 auto', width: 165, ...(sold ? { backgroundColor: 'rgba(255, 77, 79, 0.06)' } : {}) }}
    >
      <Flex vertical align="center">
        <Text strong {...danger}>{rank}.</Text>
        <Link
          href={car.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          strong
          type={sold ? 'danger' : undefined}
          delete={sold}
          underline={!sold}
        >
          {car.listingId} {car.locationCity}
        </Link>
        <Text type={sold ? 'danger' : 'secondary'}>
          €{car.basePriceEuro.toLocaleString()} • {car.mileageKm.toLocaleString()} km
        </Text>
        {sold ? <Text type="danger" style={{ fontSize: '11px' }}>SATILDI</Text> : ageBadge(listingAgeInDays(car.listingDates?.createdTime))}
        <Tooltip
          title={showBreakdown && car.scoreBreakdown?.length ? <ScoreBreakdown breakdown={car.scoreBreakdown} total={car.totalScore} /> : null}
          placement="bottom"
          autoAdjustOverflow
          overlayStyle={{ maxWidth: '92vw' }}
        >
          <Text strong style={{ fontSize: '13px', marginTop: 4 }}>
            {category.scoreLabel}: {category.format ? category.format(score) : formatScore(score)}
            {maxScore != null ? ` / ${category.format ? category.format(maxScore) : maxScore}` : ''}
          </Text>
        </Tooltip>
      </Flex>
    </Card>
  );
};

const CategoryRow = ({ category, evaluatedListings }) => {
  const picks = rankPicks(evaluatedListings, category);
  if (picks.length === 0) return null;
  return (
    <Flex vertical gap="small">
      <Text strong>{category.icon} {category.label}</Text>
      {category.hint && <Text type="secondary" style={{ fontSize: '12px', marginTop: -6 }}>{category.hint}</Text>}
      {/* Tek satır: kartlar sarmalanmaz, kutunun İÇİNDE yatay kaydırılır (sayfa taşmaz). */}
      <Flex gap="middle" wrap="nowrap" style={{ overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'thin' }}>
        {picks.map((car, index) => (
          <RankedPick key={car.listingId} car={car} rank={index + 1} category={category} />
        ))}
      </Flex>
    </Flex>
  );
};

export const Recommendations = ({ evaluatedListings }) => (
  <Card title="🎯 Claude'un Önerileri">
    <Flex vertical gap="large">
      {TIERS.map(tier => {
        const cats = CATEGORIES.filter(c => c.tier === tier.key);
        // Bu katmandaki tüm kategoriler boşsa (hiç pick yok) başlığı da gizle.
        const anyPicks = cats.some(c => rankPicks(evaluatedListings, c).length > 0);
        if (!anyPicks) return null;
        return (
          <Flex key={tier.key} vertical gap="middle">
            <Text strong style={{ fontSize: '15px' }}>{tier.icon} {tier.title}</Text>
            {cats.map(category => (
              <CategoryRow key={category.label} category={category} evaluatedListings={evaluatedListings} />
            ))}
          </Flex>
        );
      })}
    </Flex>
  </Card>
);
