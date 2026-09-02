import { useState, useEffect, useRef, memo } from 'react';
import { Card, Flex, Table, Typography, Space, Button, Modal, Timeline, Tooltip, Grid } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { equipmentRules, dealersData, getColorHex, getInteriorHex, UI_COLORS } from '../../data';
import { FeatureIcon, StarRating, ColorDisplay, InteriorDisplay } from './Icons';
import { MobileCarCards } from './MobileCarCards';
import { diffListings, findTwin } from '../../utils/listingDiff';
import { TwinDiffTable } from './TwinDiffTable';
import { FreezeButton } from './FreezeButton';
import { formatNotes, formatAdditionalFeatures, findDealerForListing, dealerUrlsOf, hostnameOf } from '../../utils/helpers';
import { listingCreatedAt, listingSoldAt, carListingAgeDays } from '../../utils/pricingCalculator';
import { DRIVETRAIN_FORMULA } from '../../../scripts/lib/drivetrain';

const { Text, Link } = Typography;

// Tablo TERSTIR: her arac bir SUTUN. antd yalnizca SATIRLARI sanallastirir, sutunlari
// DEGIL — 900 araclik havuzda her satir 900 hucre uretir ve sekme kilitlenir. Bu yuzden
// yatay pencereleme burada yapilir: yalnizca ekranda gorunen sutunlar (+ overscan)
// cizilir, solda/sagda kalanlar tek bir bosluk sutunuyla temsil edilir (kaydirma
// genisligi ve konumu birebir korunur).
const COL_W = 120;          // arac sutunu genisligi (px)
const FIXED_COL_W = 140;    // soldaki "Özellik" sutunu
const COL_OVERSCAN = 6;     // gorunur pencerenin iki yanina eklenen tampon sutun

// extraHeaderActions her render'da yeni referans alır (inline JSX, örn. yıl sekmesindeki
// "Tüm İlanları Aç" butonu) — bilerek karşılaştırma dışı: aksi halde memo hiç iş yapmaz.
const carTablePropsAreEqual = (prev, next) =>
  prev.cars === next.cars &&
  prev.title === next.title &&
  prev.winningCarIndex === next.winningCarIndex &&
  prev.isRejected === next.isRejected &&
  prev.rejectedLabel === next.rejectedLabel &&
  prev.yearLabel === next.yearLabel;

// Karsilastirma tablosu arac basina SUTUN olusturur; tum kategoriler seciliyken
// havuz 400+ araca cikar ve sinirsiz sutun tarayiciyi kilitler (site acilmiyor).
// Gorunur arac kumesini YALNIZCA filtre cubugu belirler; tabloda kirpma yoktur.

const CarTableComponent = ({
  cars,
  title,
  extraHeaderActions,
  winningCarIndex = -1,
  isRejected = false,
  rejectedLabel = 'RED',
  yearLabel = ''
}) => {
  const tableRef = useRef(null);
  const [colWindow, setColWindow] = useState({ start: 0, end: COL_OVERSCAN * 4 });
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedCarHistory, setSelectedCarHistory] = useState(null);
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false; // md altı (telefon/dar) → kart görünümü

  // Yatay kaydirma penceresi: gorunur sutun araligini scrollLeft'ten hesaplar.
  useEffect(() => {
    const body = tableRef.current?.querySelector('.ant-table-body');
    if (!body) return undefined;
    const update = () => {
      const first = Math.max(0, Math.floor((body.scrollLeft - FIXED_COL_W) / COL_W) - COL_OVERSCAN);
      const visible = Math.ceil(body.clientWidth / COL_W) + COL_OVERSCAN * 2;
      setColWindow(prev => (prev.start === first && prev.end === first + visible)
        ? prev
        : { start: first, end: first + visible });
    };
    update();
    body.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { body.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [cars.length, isMobile]);

  const showHistory = (car) => {
    setSelectedCarHistory(car);
    setHistoryModalVisible(true);
  };

  const fixedColumn = [
    {
      title: 'Özellik',
      dataIndex: 'prop',
      key: 'prop',
      fixed: 'left',
      width: FIXED_COL_W,
      render: (text, record) => record.isSection
        ? <Text strong style={{ fontSize: '13px' }}>{text}</Text>
        : <Text strong={record.isFeature} type={record.isFeature ? "warning" : "secondary"}>{text}</Text>,
      onCell: (record) => record.isSection ? { style: { backgroundColor: UI_COLORS.sectionBg, borderBottom: `2px solid ${UI_COLORS.sectionBorder}` } } : {}
    }
  ];

  const windowStart = Math.max(0, Math.min(colWindow.start, Math.max(0, cars.length - 1)));
  const windowEnd = Math.min(cars.length, colWindow.end);
  const spacer = (key, width) => width > 0 ? [{ key, dataIndex: key, width, render: () => null }] : [];

  const columns = [
    ...fixedColumn,
    ...spacer('spacer_left', windowStart * COL_W),
    ...cars.slice(windowStart, windowEnd).map((car, offset) => {
      const index = windowStart + offset;
      return ({
      title: (
        <Flex vertical align="center">
          <Link strong href={car.listingUrl} target="_blank" delete={isRejected || car.isSold} underline={!isRejected && !car.isSold}>{car.listingId}</Link>
          {/* Merge edilen aracin bayi linkleri ALT ALTA — her iki ilan da ziyaret edilebilir. */}
          {dealerUrlsOf(car).filter(u => u !== car.listingUrl).map(u => (
            <Link key={u} href={u} target="_blank" style={{ fontSize: 10 }}>🔗 {hostnameOf(u)}</Link>
          ))}
          {isRejected && <Text type="danger">{rejectedLabel}</Text>}
          {car.isSold && !isRejected && <Text type="danger" style={{ fontSize: '11px' }}>SATILDI</Text>}
          {car.isKazali && !isRejected && <Text type="warning" strong style={{ fontSize: '11px' }}>💥 KAZALI</Text>}
          {car.curatorPickBadge && !isRejected && !car.isSold && <Text>{car.curatorPickBadge}</Text>}
          <FreezeButton listingId={car.listingId} showLabel />
          {car.auditHistory && car.auditHistory.length > 0 && (
            <Button type="text" size="small" icon={<ClockCircleOutlined />} onClick={() => showHistory(car)} style={{ marginTop: 4, fontSize: '12px' }}>
              Geçmiş
            </Button>
          )}
        </Flex>
      ),
      dataIndex: car.listingId,
      key: car.listingId,
      align: 'center',
      width: 120,
      onCell: (record) => {
        const style = {};
        if (record.isSection) Object.assign(style, { backgroundColor: UI_COLORS.sectionBg, borderBottom: `2px solid ${UI_COLORS.sectionBorder}` });
        else if (car.isKazali) Object.assign(style, { backgroundColor: UI_COLORS.kazaliBg });   // kazalı → sarı-amber zemin (SATILDI kırmızısından net ayrışır)
        else if (car.isSold) Object.assign(style, { backgroundColor: UI_COLORS.soldBg });
        else if (car.curatorPickBadge) Object.assign(style, { backgroundColor: UI_COLORS.buyableBg });
        return { style };
      },
      // Hucre degeri TEMBEL: satir tanimindaki cell(car) yalnizca gorunur hucre icin
      // cagrilir (antd virtual). Onceden hesaplama, tum kategoriler seciliyken
      // ~940 arac × ~30 satir = on binlerce hucreyi bir anda uretip sayfayi kilitliyordu.
      render: (_dataIndexValue, record) => {
        if (record.isSection) return null;
        const val = typeof record.cell === 'function' ? record.cell(car) : undefined;
        if (record.isColor) {
          if (car.overrideFeatures?.exteriorColorName) return <ColorDisplay colorCode={getColorHex(car.exteriorColorName)} colorName={car.exteriorColorName} paintLabel={car.exteriorPaintLabel} />;
          return <ColorDisplay colorCode={getColorHex(car.exteriorColorName)} colorName={car.exteriorColorName} paintLabel={car.exteriorPaintLabel} />;
        }
        if (record.isInterior) {
          return (
            <InteriorDisplay
              colorCode={getInteriorHex(car.interiorColorName)}
              colorName={car.interiorColorName}
              alcantara={car.equipmentFeatures?.KGNL === 'yes'}
            />
          );
        }
        if (record.isFeatureIcon) {
          return <FeatureIcon car={car} code={record.propName} />;
        }
        if (record.isTotal) {
          return <Text strong type="warning">€{val?.toLocaleString()}</Text>;
        }
        if (record.isDealScore) {
          return <Text strong type={index === winningCarIndex ? "success" : "secondary"}>€{val?.toLocaleString()}</Text>;
        }
        return <Text>{val}</Text>;
      }
      });
    }),
    ...spacer('spacer_right', (cars.length - windowEnd) * COL_W),
  ];

  const overrideLabels = {
    co2EmissionsGramPerKm: (v) => `CO₂: ${v} g/km`,
    exteriorColorName: (v) => `Renk: ${v}`,
    mileageKm: (v) => `KM: ${v?.toLocaleString?.() || v}`,
    drivetrainType: (v) => `Tahrik: ${v}`,
    vin: (v) => `VIN: ${v}`,
    S403A: (v) => `Sunroof: ${v === 'no' ? '❌' : '✅'}`,
  };

  // Override değeri { value, reason } objesi veya düz değer olabilir
  const getOverrideValue = (entry) => entry?.value !== undefined ? entry.value : entry;
  const getOverrideReason = (entry) => entry?.reason || null;

  const formatOverrides = (car) => {
    const ov = car.overrideFeatures;
    if (!ov || !Object.keys(ov).length) return null;
    return Object.entries(ov).map(([k, v]) => {
      const val = getOverrideValue(v);
      const reason = getOverrideReason(v);
      const fmt = overrideLabels[k];
      const label = fmt ? fmt(val) : `${k}: ${val}`;
      return reason ? `${label} (${reason})` : label;
    }).join('\n');
  };

  const dataSource = [
    { key: 'color', prop: 'Dış Renk', isColor: true },
    { key: 'interior', prop: 'İç Renk', isInterior: true },
    { key: 'drive', prop: 'Tahrik', cell: (car) => {
      const override = car.overrideFeatures?.drivetrainType;
      const weak = car.drivetrainCertain === false && !override;
      const reason = override
        ? `Manuel override${getOverrideReason(override) ? `: ${getOverrideReason(override)}` : ' (kullanıcı teyidi)'}`
        : (car.drivetrainReason || (weak
            ? 'Sinyal yok: ne ilan metninde (xDrive/Allrad/Heckantrieb) ne de mobile.de checkbox\'ında tahrik bilgisi var. xDrive varsayıldı — satıcıdan doğrulanmalı.'
            : 'Doğrulanmış: ilan metni tahrik tipini yazıyor, ya da metin sessizken mobile.de checkbox\'ı işaretli.'));
      const tooltip = (
        <>
          <div>{reason}</div>
          <div style={{ marginTop: 6, opacity: 0.8 }}>{DRIVETRAIN_FORMULA}</div>
        </>
      );
      const cell = (
        <Tooltip title={tooltip}>
          <Text type={weak ? 'warning' : undefined}>{car.drivetrainType} {weak ? '⚠️' : '✅'}</Text>
        </Tooltip>
      );
      return (cell);
    } },
    { key: 'price', prop: 'Fiyat', cell: (car) => `€${car.basePriceEuro?.toLocaleString()}` },
    { key: 'mileage', prop: 'Kilometre', cell: (car) => `${car.mileageKm?.toLocaleString()} km` },
    { key: 'registration', prop: 'İlk Tescil', cell: (car) => {
      const [y, m] = car.firstRegistrationYearAndMonth || [];
      return ((y != null && m != null) ? `${m.toString().padStart(2, '0')}/${y}` : '?');
    } },
    { key: 'generation', prop: 'Nesil', cell: (car) => car.modelGenerationCertain === false ? '⚠️ Belirsiz (LCI?)' : (car.modelGeneration === 'LCI' ? '🔥 Facelift (LCI)' : car.modelGeneration) },
    { key: 'co2', prop: 'CO₂', cell: (car) => car.co2EmissionsGramPerKm ? `${car.co2EmissionsGramPerKm} g/km` : '?' },
    { key: 'overrides', prop: '🔧 Override', cell: (car) => {
      const text = formatOverrides(car);
      return (text ? formatNotes(text.split('\n')) : '—');
    } },
    { key: 'additionalFeatures', prop: '✨ Ek Özellikler', cell: (car) => formatAdditionalFeatures(car.listingAdditionalFeatures) },
    { key: 'notes', prop: '📝 Satıcı Açıklaması', cell: (car) => formatNotes(car.listingDescriptionNotes) },
    { key: 'personalNotes', prop: '💭 Kişisel', cell: (car) => formatNotes(car.curatorPersonalNotes) },
    { key: 'aiCommentary', prop: '🤖 AI Yorumu', cell: (car) => formatNotes(car.aiCommentary) },
  ];

  // Ikiz satiri yalnizca en az bir aracin twin baglantisi varsa eklenir.
  const hasAnyTwin = cars.some(car => findTwin(car));
  const listingInfoSource = [
    // Ikiz suphesi: bayi kaydi ile mobile.de kaydinin celisen alanlari (tek kaynak: listingDiff).
    ...(!hasAnyTwin ? [] : [{ key: 'twin_row', prop: '⚠️ İkiz Şüphesi', cell: (car) => {
      const twin = findTwin(car);
      if (!twin) return ('—');
      const diffs = diffListings(car, twin);
      if (diffs.length === 0) return (`${twin.listingId} — fark yok`);
      return ((
        <Tooltip key="twin" styles={{ body: { maxWidth: 380 } }} title={<TwinDiffTable car={car} twin={twin} />}>
          <span style={{ cursor: 'help', color: '#d48806', fontWeight: 600 }}>
            {twin.listingId} · {diffs.length} çelişki ⓘ
          </span>
        </Tooltip>
      ));
    } }]),
    { key: 'loc', prop: 'Konum', cell: (car) => car.listingLocation },
    { key: 'seller', prop: 'Satıcı', cell: (car) => car.sellerTypeOrName },
    { key: 'dealerNotes', prop: '🏢 Bayi Notları', cell: (car) => {
      const dealer = findDealerForListing(car.sellerTypeOrName, dealersData);
      if (!dealer) return ('—');
      const allNotes = [...dealer.notes, ...(dealer.website ? [`🔗 ${dealer.website}`] : [])];
      return (allNotes.length > 0 ? formatNotes(allNotes) : '—');
    } },
    { key: 'owners', prop: 'Sahip Sayısı', cell: (car) => car.numberOfPreviousOwners },
    { key: 'warranty', prop: 'Garanti', cell: (car) => car.warranty?.exists === 'yes' ? 'Evet' : (car.warranty?.exists === 'no' ? 'Hayır' : '?') },
    { key: 'service', prop: 'Tam Servis', cell: (car) => car.service?.type === 'yes' ? 'Evet' : (car.service?.type === 'no' ? 'Hayır' : '?') },
    { key: 'inspection', prop: 'Muayene (TÜV)', cell: (car) => car.nextInspectionDate },
    { key: 'dates', prop: '📅 İlan Tarihleri', cell: (car) => {
      const dates = car.listingDates || {};
      const history = car.auditHistory || [];
      const published = history.find(h => h.action?.includes('İlan Yayınlandı'));
      const sold = listingSoldAt(car);
      const fmt = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : null;
      const daysColor = (d) => d < 7 ? UI_COLORS.statusFresh : d < 14 ? UI_COLORS.statusWarning : UI_COLORS.statusStale;
      const parts = [];
      // Re-list'e dayanikli ilk yayin tarihi (tek kaynak pricingCalculator) — bayi ilani
      // kapatip yeni ID ile acinca createdTime sifirlanir, audit'teki ilk yayin kaydi kalir.
      const createdDate = listingCreatedAt(car) || published?.auditDate;
      if (createdDate) parts.push(`Yayın: ${fmt(createdDate)}`);
      if (dates.modifiedTime) parts.push(`Güncelleme: ${fmt(dates.modifiedTime)}`);
      if (dates.renewedTime && dates.renewedTime !== dates.createdTime) parts.push(`Yenileme: ${fmt(dates.renewedTime)}`);
      if (sold) parts.push(`Satıldı: ${fmt(sold)}`);
      if (createdDate) {
        // Gün hesabı TEK kaynakta (pricingCalculator) — skor tooltip'i ile tablo asla ayrışmasın.
        const days = carListingAgeDays(car);
        const label = sold ? `${days} günde satıldı` : `${days} gündür yayında`;
        return (<span key={car.listingId}>{parts.join(' · ')} · <span style={{ color: daysColor(days), fontWeight: 600 }}>📌 {label}</span></span>);
      }
      return (parts.length > 0 ? parts.join(' · ') : '—');
    } },
  ];

  const threeStarFeatures = equipmentRules
    .filter(feature => feature.score === 3)
    .sort((a, b) => {
      if (a.code === 'S403A') return -1;
      if (b.code === 'S403A') return 1;
      return (b.price * b.score) - (a.price * a.score);
    });
  const threeStarSource = threeStarFeatures.map(feature => ({
    key: `feat_${feature.name}`,
    prop: <Space size={4}><StarRating count={3}/><Text>{feature.name} <Text type="secondary" style={{ fontSize: '11px' }}>({feature.code})</Text> <Text type="secondary" style={{ fontSize: '11px' }}>(~€{feature.price.toLocaleString()})</Text></Text></Space>,
    propName: feature.code,
    isFeature: true,
    isFeatureIcon: true,
  }));

  const twoStarFeatures = equipmentRules
    .filter(feature => feature.score === 2)
    .sort((a, b) => (b.price * b.score) - (a.price * a.score));
  const twoStarSource = twoStarFeatures.map(feature => ({
    key: `feat_${feature.name}`,
    prop: <Space size={4}><StarRating count={2}/><Text>{feature.name} <Text type="secondary" style={{ fontSize: '11px' }}>({feature.code})</Text> <Text type="secondary" style={{ fontSize: '11px' }}>(~€{feature.price.toLocaleString()})</Text></Text></Space>,
    propName: feature.code,
    isFeature: true,
    isFeatureIcon: true,
  }));

  const oneStarFeatures = equipmentRules
    .filter(feature => feature.score === 1)
    .sort((a, b) => b.price - a.price);
  const oneStarSource = oneStarFeatures.map(feature => ({
    key: `feat_${feature.name}`,
    prop: <Space size={4}><StarRating count={1}/><Text>{feature.name} <Text type="secondary" style={{ fontSize: '11px' }}>({feature.code})</Text> <Text type="secondary" style={{ fontSize: '11px' }}>(~€{feature.price.toLocaleString()})</Text></Text></Space>,
    propName: feature.code,
    isFeature: true,
    isFeatureIcon: true,
  }));

  const zeroStarFeatures = equipmentRules
    .filter(feature => feature.score === 0)
    .sort((a, b) => b.price - a.price);
  const zeroStarSource = zeroStarFeatures.map(feature => ({
    key: `feat_${feature.name}`,
    prop: <Text>{feature.name} <Text type="secondary" style={{ fontSize: '11px' }}>({feature.code})</Text> <Text type="secondary" style={{ fontSize: '11px' }}>(~€{feature.price.toLocaleString()})</Text></Text>,
    propName: feature.code,
    isFeature: true,
    isFeatureIcon: true,
  }));

  const costSource = [
    { key: 'price_row', prop: 'Fiyat', cell: (car) => `€${car.basePriceEuro?.toLocaleString()}` },
    { key: 'bpm_calc_row', prop: '+ BPM', cell: (car) => {
      const calc = car.metrics?.bpmCalculation;
      // Muaf (NL) → 0 falsy olduğu için '?' branch'inden ÖNCE kontrol edilmeli.
      if (calc?.exempt) return (`€0 — ${calc.exemptCountry} tescilli, BPM ödenmiş`);
      if (!calc?.bpmCalculated) return ('?');
      return (`€${calc.bpmCalculated.toLocaleString()} (${calc.depreciationPercent}% afs., ${calc.tariefYear} tarief)`);
    } },
  ];

  const evaluationSource = [
    { key: 'age_row', prop: 'Yaş', cell: (car) => `${car.metrics?.ageInMonths || '?'} ay → €${car.metrics?.agePenalty?.toLocaleString() || '?'}` },
    { key: 'kmpen_row', prop: 'Kilometre', cell: (car) => `${car.mileageKm?.toLocaleString() || '?'} km → €${car.metrics?.mileagePenalty?.toLocaleString() || '?'}` },
    { key: 'depreciation_row', prop: 'Yıpranma', cell: (car) => `+€${car.metrics?.totalDepreciation?.toLocaleString() || '?'}` },
    { key: 'extfeat_row', prop: '− Donanım (beklenen dahil)', cell: (car) => {
      const m = car.metrics || {};
      if (m.extraFeaturesValue == null) return ('?');
      return (`−€${(m.extraFeaturesValue + (m.upsideGap || 0)).toLocaleString()}`);
    } },
    { key: 'deal_score_row', prop: 'FIRSAT FİYATI', isDealScore: true, cell: (car) => car.metrics?.expectedDealScore ?? car.metrics?.personalDealScore },
    { key: 'upside_row', prop: '🔍 Belirsiz Donanım', cell: (car) => {
      const m = car.metrics || {};
      const cnt = m.unknownsCount || 0;
      if (!cnt) return ('—');
      const parts = [`${cnt} kalem`];
      if (m.upsideGap != null) parts.push(`beklenen +€${m.upsideGap.toLocaleString()}`);
      if (m.unknownsPotentialValue != null) parts.push(`max +€${m.unknownsPotentialValue.toLocaleString()}`);
      return (parts.join(' • '));
    } },
  ];

  const renderTitle = () => {
    if (extraHeaderActions) {
      return (
        <Flex justify="space-between" align="center">
          <span>{title}</span>
          {extraHeaderActions}
        </Flex>
      );
    }
    return title;
  };

  // Bolum basligi satiri: hucre degeri yok (render isSection'da null doner).
  const sectionHeader = (label) => ({ key: `section_${label}`, prop: label, isSection: true });

  // Yıldız bölümü boşsa (o skorda hiç donanım yok) başlığı da gizle — boş "3 Yıldızlı" başlığı çıkmasın.
  const starSection = (label, source) => source.length ? [sectionHeader(label), ...source] : [];

  const unifiedSource = [
    ...dataSource,
    sectionHeader(`🇳🇱 BPM & Toplam Maliyet ${yearLabel}`),
    ...costSource,
    sectionHeader(`📉 Yıpranma & Düzeltilmiş ${yearLabel}`),
    ...evaluationSource,
    sectionHeader(`📋 İlan Bilgisi ${yearLabel}`),
    ...listingInfoSource,
    ...starSection(`⭐⭐⭐ 3 Yıldızlı Donanımlar ${yearLabel}`, threeStarSource),
    ...starSection(`⭐⭐ 2 Yıldızlı Donanımlar ${yearLabel}`, twoStarSource),
    ...starSection(`⭐ 1 Yıldızlı Donanımlar ${yearLabel}`, oneStarSource),
    ...starSection(`Opsiyonel Donanımlar ${yearLabel}`, zeroStarSource),
  ];

  return (
    <Flex vertical gap="large">
      <Card title={renderTitle()} styles={{ body: isMobile ? { padding: 10 } : undefined }}>
        {isMobile
          ? <MobileCarCards cars={cars} isRejected={isRejected} rejectedLabel={rejectedLabel} />
          : <div ref={tableRef}>
              {/* scroll.x TAM genislik (bosluk sutunlariyla korunur) — kaydirma cubugu
                  havuzun tamamini temsil eder; DOM'a yalnizca pencere cizilir. */}
              <Table dataSource={unifiedSource} columns={columns} pagination={false} size="small"
                scroll={{ x: FIXED_COL_W + cars.length * COL_W, y: 900 }} rowHoverable={false} />
            </div>}
      </Card>

      <Modal
        title={`İlan Geçmişi: ${selectedCarHistory?.listingId}`}
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={null}
        width={600}
      >
        <Timeline
          style={{ marginTop: '20px' }}
          items={selectedCarHistory?.auditHistory?.map(h => {
             const dateStr = h.auditDate ? new Date(h.auditDate).toLocaleDateString('tr-TR') : '?';
             return {
                children: (
                  <>
                    <Text strong>{h.action}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '13px' }}>{dateStr}</Text>
                    {h.detail && (
                      <div style={{ marginTop: '8px' }}>
                        <Text>{h.detail}</Text>
                      </div>
                    )}
                  </>
                )
             };
          })}
        />
      </Modal>
    </Flex>
  );
};

export const CarTable = memo(CarTableComponent, carTablePropsAreEqual);
