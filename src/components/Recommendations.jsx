import React from 'react';
import { Card, Flex, Typography, Tooltip } from 'antd';

const { Text, Link } = Typography;

const formatDelta = (d) => (d > 0 ? `+${d}` : `${d}`);

const ScoreBreakdown = ({ breakdown }) => (
  <Flex vertical gap={2} style={{ fontSize: '11px', textAlign: 'left' }}>
    {breakdown.map((b, i) => (
      <Text key={i} style={{ color: b.delta >= 0 ? '#52c41a' : '#ff4d4f' }}>
        {formatDelta(b.delta)} {b.label}
      </Text>
    ))}
  </Flex>
);

const CATEGORIES = [
  {
    icon: '👑',
    label: 'En iyi donanım',
    scoreLabel: 'Donanım',
    scoreOf: c => c.metrics.criticalFeaturesScore,
    maxScoreOf: c => c.metrics.maxCriticalScore,
  },
  {
    icon: '🏆',
    label: 'Genel en iyi',
    scoreLabel: 'Toplam',
    scoreOf: c => c.totalScore,
  },
  {
    icon: '💰',
    label: 'En iyi değer',
    scoreLabel: 'Değer',
    filter: c => c.metrics.adjustedCost < 70000,
    scoreOf: c => c.totalScore,
  },
  {
    icon: '⚖️',
    label: 'Dengeli seçim',
    scoreLabel: 'Denge',
    filter: c => c.metrics.criticalFeaturesScore >= 4 && c.metrics.adjustedCost <= 75000,
    scoreOf: c => (c.totalScore + c.metrics.criticalFeaturesScore) / 2,
  },
];

const rankPicks = (evaluatedListings, category) => {
  const pool = category.filter ? evaluatedListings.filter(category.filter) : evaluatedListings;
  return [...pool].sort((a, b) => category.scoreOf(b) - category.scoreOf(a)).slice(0, 5);
};

const formatScore = (n) => (typeof n === 'number' ? Math.round(n * 10) / 10 : n);

const RankedPick = ({ car, rank, category }) => {
  const sold = !!car.isSold;
  const danger = sold ? { type: 'danger' } : {};
  const score = category.scoreOf(car);
  const maxScore = category.maxScoreOf?.(car);
  const showBreakdown = category.scoreLabel !== 'Donanım skoru';
  return (
    <Card hoverable type="inner" size="small" style={sold ? { backgroundColor: 'rgba(255, 77, 79, 0.06)' } : undefined}>
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
        {sold && <Text type="danger" style={{ fontSize: '11px' }}>SATILDI</Text>}
        <Tooltip
          title={showBreakdown && car.scoreBreakdown?.length ? <ScoreBreakdown breakdown={car.scoreBreakdown} /> : null}
          placement="bottom"
        >
          <Text strong style={{ fontSize: '13px', marginTop: 4 }}>
            {category.scoreLabel}: {formatScore(score)}{maxScore != null ? ` / ${maxScore}` : ''}
          </Text>
        </Tooltip>
      </Flex>
    </Card>
  );
};

export const Recommendations = ({ evaluatedListings }) => (
  <Card title="🎯 Claude'un Önerileri">
    <Flex vertical gap="middle">
      {CATEGORIES.map(category => {
        const picks = rankPicks(evaluatedListings, category);
        if (picks.length === 0) return null;
        return (
          <Flex key={category.label} vertical gap="small">
            <Text strong>{category.icon} {category.label}</Text>
            <Flex gap="middle" wrap="wrap">
              {picks.map((car, index) => (
                <RankedPick key={car.listingId} car={car} rank={index + 1} category={category} />
              ))}
            </Flex>
          </Flex>
        );
      })}
    </Flex>
  </Card>
);
