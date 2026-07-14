import React from 'react';
import { Card, Flex, Typography, Tooltip } from 'antd';

const { Text, Link } = Typography;

const formatDelta = (d) => (d > 0 ? `+${d}` : `${d}`);
const formatEuro = (v) => `€${Math.round(v).toLocaleString('tr-TR')}`;
const formatDrop = (v) => `−€${Math.round(v).toLocaleString('tr-TR')}`;

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

const CATEGORIES = [
  {
    icon: '👑',
    label: 'En iyi donanım',
    scoreLabel: 'Donanım',
    hint: 'En yüklü araç — donanımın € değeri (fiyat/renk sayılmaz).',
    scoreOf: c => c.metrics.expectedFeaturesValue,
    maxScoreOf: c => c.metrics.maxFeaturesValue,
    format: formatEuro,
  },
  {
    icon: '🏆',
    label: 'Genel en iyi',
    scoreLabel: 'Toplam',
    hint: 'Tüm kriterler dengeli (renk/arzu ağırlıklı genel favori).',
    scoreOf: c => c.totalScore,
    maxScoreOf: () => 100,
  },
  {
    icon: '💰',
    label: 'En iyi değer',
    scoreLabel: 'Değer',
    hint: 'Bang-for-buck: donanım€ / toplam maliyet€ — en çok araba, en az para.',
    scoreOf: c => c.valueScore,
    maxScoreOf: () => 100,
  },
  {
    icon: '⚖️',
    label: 'Dengeli seçim',
    scoreLabel: 'Denge',
    hint: 'Hiçbir yönü zayıf değil — 4 boyutun geometrik ortalaması.',
    scoreOf: c => c.balanceScore,
    maxScoreOf: () => 100,
  },
  {
    icon: '📉',
    label: 'Fiyatı düşenler',
    scoreLabel: 'Düşüş',
    hint: 'Satıcı fiyat kırmış → motivasyonlu, pazarlık şansı yüksek.',
    filter: c => c.metrics.priceDropTotal > 0 && c.metrics.baseTotalCost <= 66000,
    scoreOf: c => c.metrics.priceDropTotal,
    format: formatDrop,
  },
];

const PICKS_PER_CATEGORY = 12;

const rankPicks = (evaluatedListings, category) => {
  const pool = category.filter ? evaluatedListings.filter(category.filter) : evaluatedListings;
  return [...pool].sort((a, b) => category.scoreOf(b) - category.scoreOf(a)).slice(0, PICKS_PER_CATEGORY);
};

export const computeSuggestedIds = (evaluatedListings) => {
  const ids = new Set();
  CATEGORIES.forEach(category => {
    rankPicks(evaluatedListings, category).forEach(c => ids.add(c.listingId));
  });
  return [...ids];
};

const formatScore = (n) => (typeof n === 'number' ? Math.round(n * 10) / 10 : n);

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
        {sold && <Text type="danger" style={{ fontSize: '11px' }}>SATILDI</Text>}
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

export const Recommendations = ({ evaluatedListings }) => (
  <Card title="🎯 Claude'un Önerileri">
    <Flex vertical gap="middle">
      {CATEGORIES.map(category => {
        const picks = rankPicks(evaluatedListings, category);
        if (picks.length === 0) return null;
        return (
          <Flex key={category.label} vertical gap="small">
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
      })}
    </Flex>
  </Card>
);
