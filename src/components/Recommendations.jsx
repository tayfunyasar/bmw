import React from 'react';
import { Card, Flex, Typography, Tooltip, Tag, Space } from 'antd';
import { CATEGORIES, TIERS, rankPicks } from '../utils/recommendations';
import { listingAgeInDays } from '../utils/pricingCalculator';
import { UI_COLORS, getColorHex } from '../data';
import { ColorDisplay } from './common/Icons';
import { FreezeButton } from './common/FreezeButton';

const { Text, Link } = Typography;

const formatDelta = (d) => (d > 0 ? `+${d}` : `${d}`);
const formatScore = (n) => (typeof n === 'number' ? Math.round(n * 10) / 10 : n);

// Sıra rozeti: ilk 3'e madalya, sonrası nötr numara — kartın sol üstünde.
const RANK_BADGE = ['🥇', '🥈', '🥉'];

// İlan yaşı rozeti: yeni (≤5g) yeşil, orta sarı, bayat (≥30g) kırmızı. Staleness cezası ile hizalı.
const ageBadge = (days) => {
  if (days == null) return null;
  const color = days <= 5 ? UI_COLORS.statusFresh : days < 30 ? UI_COLORS.gaugeMid : UI_COLORS.statusStale;
  const label = days <= 5 ? `🆕 ${days} gün` : `🕐 ${days} gün`;
  return <Text style={{ fontSize: '11px', color, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</Text>;
};

const ScoreBreakdown = ({ breakdown, total }) => (
  <Flex vertical gap={3} style={{ fontSize: '11px', textAlign: 'left', width: 210, maxWidth: '78vw', wordBreak: 'break-word' }}>
    <Text style={{ color: '#bbb', fontSize: '10px' }}>Toplam skor nasıl hesaplandı (0-1 × ağırlık):</Text>
    {breakdown.map((b, i) => (
      <Flex key={i} vertical gap={0}>
        <Flex justify="space-between" gap={10}>
          <Text style={{ color: '#eee' }}>{b.label}</Text>
          <Text strong style={{ color: b.delta >= 0 ? UI_COLORS.statusFresh : UI_COLORS.statusStale, whiteSpace: 'nowrap' }}>{formatDelta(b.delta)}</Text>
        </Flex>
        {b.formula ? <Text style={{ color: UI_COLORS.muted, fontSize: '10px' }}>{b.formula}</Text> : null}
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
  const score = category.scoreOf(car);
  const maxScore = category.maxScoreOf?.(car);
  const showBreakdown = category.scoreLabel !== 'Donanım skoru';
  const badge = RANK_BADGE[rank - 1];
  // Fırsat kategorisi yeşil vurgu kutusu; diğerleri nötr mavi tonu (artifact dili).
  const isDeal = /fırsat|firsat/i.test(category.scoreLabel || category.label || '');
  const accent = isDeal ? UI_COLORS.statusFresh : UI_COLORS.link;
  const scoreText = `${category.format ? category.format(score) : formatScore(score)}${maxScore != null ? ` / ${category.format ? category.format(maxScore) : maxScore}` : ''}`;

  return (
    <Card
      hoverable
      size="small"
      styles={{ body: { padding: 12 } }}
      // Yatay scroll satırında kartlar sıkışmasın: sabit genişlik + shrink kapalı.
      style={{
        flex: '0 0 auto', width: 190, borderRadius: 12,
        // Satılmamış = alınabilir → yeşil · satılmış → kırmızı (çerçeve + zemin)
        borderColor: sold ? UI_COLORS.statusStale : UI_COLORS.statusFresh,
        backgroundColor: sold ? 'rgba(255, 77, 79, 0.06)' : 'rgba(82, 196, 26, 0.06)',
      }}
    >
      {/* Üst satır: sıra rozeti (+ SATILDI etiketi) + favori pin */}
      <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
        <Space size={6}>
          <Text strong style={{ fontSize: 15 }}>{badge ? `${badge}` : `#${rank}`}</Text>
          {sold && <Tag color="error" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px' }}>SATILDI</Tag>}
        </Space>
        <FreezeButton listingId={car.listingId} />
      </Flex>

      {/* Kimlik */}
      <Link href={car.listingUrl} target="_blank" rel="noopener noreferrer" strong
        type={sold ? 'danger' : undefined} delete={sold} underline={!sold} style={{ fontSize: 15 }}>
        {car.listingId} {car.locationCity}
      </Link>

      {/* Fiyat büyük + km · yaş */}
      <Flex vertical style={{ marginTop: 4 }}>
        <Text strong type={sold ? 'danger' : undefined} style={{ fontSize: 19, lineHeight: 1.1 }}>
          €{car.basePriceEuro.toLocaleString()}
        </Text>
        <Space size={8} style={{ marginTop: 1 }}>
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{car.mileageKm.toLocaleString()} km</Text>
          {!sold && ageBadge(listingAgeInDays(car.listingDates?.createdTime))}
        </Space>
      </Flex>

      {/* Renk (tek satır — kendine ait) */}
      <Flex align="center" style={{ marginTop: 6 }}>
        <ColorDisplay colorCode={getColorHex(car.exteriorColorName)} colorName={car.exteriorColorName} paintLabel={car.exteriorPaintLabel} compact />
      </Flex>

      {/* Vurgulu skor kutusu — fiyat düşüş kategorisinde özel gösterim (kaçtan→kaça + ilk fiyat + tarih) */}
      <Tooltip
        title={showBreakdown && !category.priceDropView && car.scoreBreakdown?.length ? <ScoreBreakdown breakdown={car.scoreBreakdown} total={car.totalScore} /> : null}
        placement="bottom" autoAdjustOverflow styles={{ root: { maxWidth: '92vw' } }}>
        <Flex vertical style={{ marginTop: 8, padding: '4px 8px', borderRadius: 8,
          background: category.priceDropView ? 'rgba(255,77,79,0.08)' : (isDeal ? 'rgba(82,196,26,0.10)' : 'rgba(24,144,255,0.08)') }}>
          {category.priceDropView ? (
            <>
              <Text style={{ fontSize: 10, color: UI_COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {category.scoreLabel}{car.metrics.lastDropDate ? ` · ${new Date(car.metrics.lastDropDate).toLocaleDateString('tr-TR')}` : ''}
              </Text>
              <Text strong style={{ fontSize: 14, color: UI_COLORS.statusStale }}>
                €{car.metrics.lastDropOldEuro?.toLocaleString()} → €{car.metrics.lastDropNewEuro?.toLocaleString()}
              </Text>
              <Text style={{ fontSize: 11, color: UI_COLORS.muted }}>İlk fiyat: €{car.metrics.firstPriceEuro?.toLocaleString()}</Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 10, color: UI_COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{category.scoreLabel}</Text>
              <Text strong style={{ fontSize: 15, color: accent }}>{scoreText}</Text>
            </>
          )}
        </Flex>
      </Tooltip>
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
