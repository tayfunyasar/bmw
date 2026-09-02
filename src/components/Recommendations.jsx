import React, { useState, useEffect, useRef } from 'react';
import { Card, Flex, Typography, Tooltip, Tag, Space } from 'antd';
import { CATEGORIES, TIERS, rankPicks } from '../utils/recommendations';
import { carListingAgeDays } from '../utils/pricingCalculator';
import { UI_COLORS, getColorHex } from '../data';
import { ColorDisplay } from './common/Icons';
import { FreezeButton } from './common/FreezeButton';
import { dealerUrlsOf, hostnameOf } from '../utils/helpers';

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
  const kazali = !!car.isKazali;
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
        // Satılmamış = alınabilir → yeşil · satılmış → kırmızı · kazalı → sarı-amber.
        // Renk kodlari THEME.json'da (UI_COLORS) — bilesende hex/rgba yazilmaz.
        borderColor: kazali ? UI_COLORS.statusWarning : sold ? UI_COLORS.statusStale : UI_COLORS.statusFresh,
        backgroundColor: kazali ? UI_COLORS.kazaliBg : sold ? UI_COLORS.soldBg : UI_COLORS.buyableBg,
      }}
    >
      {/* Üst satır: sıra rozeti (+ SATILDI etiketi) + favori pin */}
      <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
        <Space size={6}>
          <Text strong style={{ fontSize: 15 }}>{badge ? `${badge}` : `#${rank}`}</Text>
          {sold && <Tag color="error" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px' }}>SATILDI</Tag>}
          {kazali && <Tag color="warning" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px' }}>💥 KAZALI</Tag>}
        </Space>
        <FreezeButton listingId={car.listingId} />
      </Flex>

      {/* Kimlik — merge edilen aracin bayi linkleri ALT ALTA (her iki ilan ziyaret edilebilir) */}
      <Link href={car.listingUrl} target="_blank" rel="noopener noreferrer" strong
        type={sold ? 'danger' : undefined} delete={sold} underline={!sold} style={{ fontSize: 15 }}>
        {car.listingId} {car.locationCity}
      </Link>
      {dealerUrlsOf(car).filter(u => u !== car.listingUrl).map(u => (
        <Link key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, display: 'block' }}>
          🔗 {hostnameOf(u)}
        </Link>
      ))}

      {/* Fiyat büyük + km · yaş */}
      <Flex vertical style={{ marginTop: 4 }}>
        {/* TOPLAM maliyet gosterilir (ilan fiyati + BPM) — tablodaki "Toplam maliyet" ile ayni
            sayi; kullanici karari toplam uzerinden verir, ilan fiyati yaniltir (NL araclarda
            BPM zaten odenmis, DE araclarinda degil). Kaynak: metrics.baseTotalCost. */}
        <Text strong type={sold ? 'danger' : undefined} style={{ fontSize: 19, lineHeight: 1.1 }}>
          {/* Eski/eksik kayitlarda fiyat-km null olabilir (Old_7) — render coksun diye patlamaz. */}
          {car.metrics?.baseTotalCost != null ? `€${Math.round(car.metrics.baseTotalCost).toLocaleString()}` : 'Fiyat —'}
        </Text>
        {car.metrics?.bpmCalculation?.bpmCalculated > 0 && (
          <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.2 }}>
            ilan €{Math.round(car.basePriceEuro).toLocaleString()} + BPM €{Math.round(car.metrics.bpmCalculation.bpmCalculated).toLocaleString()}
          </Text>
        )}
        <Space size={8} style={{ marginTop: 1 }}>
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{car.mileageKm != null ? `${car.mileageKm.toLocaleString()} km` : '— km'}</Text>
          {!sold && ageBadge(carListingAgeDays(car))}
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

// Kart sayisinda tavan YOK — filtre cubugu neyi birakiyorsa hepsi siralanir.
// Olcek yatay PENCERELEME ile cozulur (CarTable ile ayni ilke): kaydirma konumuna
// gore yalnizca gorunen kartlar + tampon cizilir, geri kalan yer iki bosluk div'iyle
// korunur — kaydirma cubugu havuzun tamamini temsil eder.
const CARD_W = 232;      // kart genisligi + gap (px)
const CARD_OVERSCAN = 4;

const CategoryRow = ({ category, evaluatedListings }) => {
  const picks = rankPicks(evaluatedListings, category);
  const scrollerRef = useRef(null);
  const [win, setWin] = useState({ start: 0, end: CARD_OVERSCAN * 4 });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const update = () => {
      const first = Math.max(0, Math.floor(el.scrollLeft / CARD_W) - CARD_OVERSCAN);
      const visible = Math.ceil(el.clientWidth / CARD_W) + CARD_OVERSCAN * 2;
      setWin(prev => (prev.start === first && prev.end === first + visible) ? prev : { start: first, end: first + visible });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [picks.length]);

  if (picks.length === 0) return null;
  const start = Math.min(win.start, Math.max(0, picks.length - 1));
  const end = Math.min(picks.length, win.end);
  return (
    <Flex vertical gap="small">
      <Text strong>{category.icon} {category.label} <Text type="secondary" style={{ fontSize: 12 }}>({picks.length})</Text></Text>
      {category.hint && <Text type="secondary" style={{ fontSize: '12px', marginTop: -6 }}>{category.hint}</Text>}
      {/* Tek satır: kartlar sarmalanmaz, kutunun İÇİNDE yatay kaydırılır (sayfa taşmaz). */}
      <Flex ref={scrollerRef} gap="middle" wrap="nowrap" style={{ overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'thin' }}>
        {start > 0 && <div style={{ flex: `0 0 ${start * CARD_W}px` }} />}
        {picks.slice(start, end).map((car, offset) => (
          <RankedPick key={car.listingId} car={car} rank={start + offset + 1} category={category} />
        ))}
        {picks.length > end && <div style={{ flex: `0 0 ${(picks.length - end) * CARD_W}px` }} />}
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
