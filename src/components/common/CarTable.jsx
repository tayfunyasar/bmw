import { useState } from 'react';
import { Card, Flex, Table, Typography, Space, Button, Modal, Timeline, Tooltip, Grid } from 'antd';
import { ClockCircleOutlined, PushpinOutlined, PushpinFilled } from '@ant-design/icons';
import { equipmentRules, dealersData, getColorHex, getInteriorHex, UI_COLORS } from '../../data';
import { FeatureIcon, StarRating, ColorDisplay, InteriorDisplay } from './Icons';
import { MobileCarCards } from './MobileCarCards';
import { formatNotes, formatAdditionalFeatures, findDealerForListing } from '../../utils/helpers';
import { useFrozenCars } from '../useFrozenCars';
import { DRIVETRAIN_FORMULA } from '../../../scripts/lib/drivetrain';

const { Text, Link } = Typography;
const TODAY = new Date();
const TODAY_MS = TODAY.getTime();

export const CarTable = ({
  cars,
  title,
  extraHeaderActions,
  winningCarIndex = -1,
  isRejected = false,
  rejectedLabel = 'RED',
  yearLabel = ''
}) => {
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedCarHistory, setSelectedCarHistory] = useState(null);
  const { frozenIds, toggle: toggleFreeze } = useFrozenCars() || { frozenIds: [], toggle: () => {} };
  const isFrozen = (id) => frozenIds.includes(id);
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false; // md altı (telefon/dar) → kart görünümü

  const showHistory = (car) => {
    setSelectedCarHistory(car);
    setHistoryModalVisible(true);
  };

  const columns = [
    {
      title: 'Özellik',
      dataIndex: 'prop',
      key: 'prop',
      fixed: 'left',
      width: 140,
      render: (text, record) => record.isSection
        ? <Text strong style={{ fontSize: '13px' }}>{text}</Text>
        : <Text strong={record.isFeature} type={record.isFeature ? "warning" : "secondary"}>{text}</Text>,
      onCell: (record) => record.isSection ? { style: { backgroundColor: UI_COLORS.sectionBg, borderBottom: `2px solid ${UI_COLORS.sectionBorder}` } } : {}
    }
  ].concat(cars.map((car, index) => ({
      title: (
        <Flex vertical align="center">
          <Link strong href={car.listingUrl} target="_blank" delete={isRejected || car.isSold} underline={!isRejected && !car.isSold}>{car.listingId}</Link>
          {isRejected && <Text type="danger">{rejectedLabel}</Text>}
          {car.isSold && !isRejected && <Text type="danger" style={{ fontSize: '11px' }}>SATILDI</Text>}
          {car.curatorPickBadge && !isRejected && !car.isSold && <Text>{car.curatorPickBadge}</Text>}
          <Button
            type="text"
            size="small"
            icon={isFrozen(car.listingId) ? <PushpinFilled /> : <PushpinOutlined />}
            onClick={() => toggleFreeze(car.listingId)}
            style={{ marginTop: 4, fontSize: '12px', color: isFrozen(car.listingId) ? UI_COLORS.linkActive : undefined }}
          >
            {isFrozen(car.listingId) ? 'Unfreeze' : 'Freeze'}
          </Button>
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
        else if (car.isSold) Object.assign(style, { backgroundColor: 'rgba(255, 77, 79, 0.06)' });
        else if (car.curatorPickBadge) Object.assign(style, { backgroundColor: 'rgba(82, 196, 26, 0.06)' });
        return { style };
      },
      render: (val, record) => {
        if (record.isSection) return null;
        if (record.isColor) {
          if (car.overrideFeatures?.exteriorColorName) return <ColorDisplay colorCode={getColorHex(car.exteriorColorName)} colorName={car.exteriorColorName} />;
          return <ColorDisplay colorCode={getColorHex(car.exteriorColorName)} colorName={car.exteriorColorName} />;
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
          return <FeatureIcon type={car.equipmentFeatures?.[record.propName]} />;
        }
        if (record.isTotal) {
          return <Text strong type="warning">€{val?.toLocaleString()}</Text>;
        }
        if (record.isDealScore) {
          return <Text strong type={index === winningCarIndex ? "success" : "secondary"}>€{val?.toLocaleString()}</Text>;
        }
        return <Text>{val}</Text>;
      }
    })));

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
    Object.assign({ key: 'drive', prop: 'Tahrik' }, Object.fromEntries(cars.map(car => {
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
      return [car.listingId, cell];
    }))),
    Object.assign({ key: 'price', prop: 'Fiyat' }, Object.fromEntries(cars.map(car => [car.listingId, `€${car.basePriceEuro?.toLocaleString()}`]))),
    Object.assign({ key: 'mileage', prop: 'Kilometre' }, Object.fromEntries(cars.map(car => [car.listingId, `${car.mileageKm?.toLocaleString()} km`]))),
    Object.assign({ key: 'registration', prop: 'İlk Tescil' }, Object.fromEntries(cars.map(car => {
      const [y, m] = car.firstRegistrationYearAndMonth || [];
      return [car.listingId, (y != null && m != null) ? `${m.toString().padStart(2, '0')}/${y}` : '?'];
    }))),
    Object.assign({ key: 'generation', prop: 'Nesil' }, Object.fromEntries(cars.map(car => [car.listingId, car.modelGeneration === 'LCI' ? '🔥 Facelift (LCI)' : car.modelGeneration]))),
    Object.assign({ key: 'co2', prop: 'CO₂' }, Object.fromEntries(cars.map(car => [car.listingId, car.co2EmissionsGramPerKm ? `${car.co2EmissionsGramPerKm} g/km` : '?']))),
    Object.assign({ key: 'overrides', prop: '🔧 Override' }, Object.fromEntries(cars.map(car => {
      const text = formatOverrides(car);
      return [car.listingId, text ? formatNotes(text.split('\n')) : '—'];
    }))),
    Object.assign({ key: 'additionalFeatures', prop: '✨ Ek Özellikler' }, Object.fromEntries(cars.map(car => [car.listingId, formatAdditionalFeatures(car.listingAdditionalFeatures)]))),
    Object.assign({ key: 'notes', prop: '📝 Satıcı Açıklaması' }, Object.fromEntries(cars.map(car => [car.listingId, formatNotes(car.listingDescriptionNotes)]))),
    Object.assign({ key: 'personalNotes', prop: '💭 Kişisel' }, Object.fromEntries(cars.map(car => [car.listingId, formatNotes(car.curatorPersonalNotes)]))),
    Object.assign({ key: 'aiCommentary', prop: '🤖 AI Yorumu' }, Object.fromEntries(cars.map(car => [car.listingId, formatNotes(car.aiCommentary)]))),
  ];

  const listingInfoSource = [
    Object.assign({ key: 'loc', prop: 'Konum' }, Object.fromEntries(cars.map(car => [car.listingId, car.listingLocation]))),
    Object.assign({ key: 'seller', prop: 'Satıcı' }, Object.fromEntries(cars.map(car => [car.listingId, car.sellerTypeOrName]))),
    Object.assign({ key: 'dealerNotes', prop: '🏢 Bayi Notları' }, Object.fromEntries(cars.map(car => {
      const dealer = findDealerForListing(car.sellerTypeOrName, dealersData);
      if (!dealer) return [car.listingId, '—'];
      const allNotes = [...dealer.notes, ...(dealer.website ? [`🔗 ${dealer.website}`] : [])];
      return [car.listingId, allNotes.length > 0 ? formatNotes(allNotes) : '—'];
    }))),
    Object.assign({ key: 'owners', prop: 'Sahip Sayısı' }, Object.fromEntries(cars.map(car => [car.listingId, car.numberOfPreviousOwners]))),
    Object.assign({ key: 'warranty', prop: 'Garanti' }, Object.fromEntries(cars.map(car => [car.listingId, car.warranty?.exists === 'yes' ? 'Evet' : (car.warranty?.exists === 'no' ? 'Hayır' : '?')]))),
    Object.assign({ key: 'service', prop: 'Tam Servis' }, Object.fromEntries(cars.map(car => [car.listingId, car.service?.type === 'yes' ? 'Evet' : (car.service?.type === 'no' ? 'Hayır' : '?')]))),
    Object.assign({ key: 'inspection', prop: 'Muayene (TÜV)' }, Object.fromEntries(cars.map(car => [car.listingId, car.nextInspectionDate]))),
    Object.assign({ key: 'dates', prop: '📅 İlan Tarihleri' }, Object.fromEntries(cars.map(car => {
      const dates = car.listingDates || {};
      const history = car.auditHistory || [];
      const published = history.find(h => h.action?.includes('İlan Yayınlandı'));
      const sold = history.find(h => h.action?.startsWith('SATILDI') || h.action?.includes('İlan Satıldı'));
      const fmt = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : null;
      const daysColor = (d) => d < 7 ? UI_COLORS.statusFresh : d < 14 ? UI_COLORS.statusWarning : UI_COLORS.statusStale;
      const parts = [];
      const createdDate = dates.createdTime || published?.auditDate;
      if (createdDate) parts.push(`Yayın: ${fmt(createdDate)}`);
      if (dates.modifiedTime) parts.push(`Güncelleme: ${fmt(dates.modifiedTime)}`);
      if (dates.renewedTime && dates.renewedTime !== dates.createdTime) parts.push(`Yenileme: ${fmt(dates.renewedTime)}`);
      if (sold) parts.push(`Satıldı: ${fmt(sold.auditDate)}`);
      if (createdDate) {
        const endMs = sold ? new Date(sold.auditDate).getTime() : TODAY_MS;
        const days = Math.floor((endMs - new Date(createdDate).getTime()) / 86400000);
        const label = sold ? `${days} günde satıldı` : `${days} gündür yayında`;
        return [car.listingId, <span key={car.listingId}>{parts.join(' · ')} · <span style={{ color: daysColor(days), fontWeight: 600 }}>📌 {label}</span></span>];
      }
      return [car.listingId, parts.length > 0 ? parts.join(' · ') : '—'];
    }))),
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
    Object.assign({ key: 'price_row', prop: 'Fiyat' }, Object.fromEntries(cars.map(car => [car.listingId, `€${car.basePriceEuro?.toLocaleString()}`]))),
    Object.assign({ key: 'bpm_calc_row', prop: '+ BPM' }, Object.fromEntries(cars.map(car => {
      const calc = car.metrics?.bpmCalculation;
      if (!calc?.bpmCalculated) return [car.listingId, '?'];
      return [car.listingId, `€${calc.bpmCalculated.toLocaleString()} (${calc.depreciationPercent}% afs., ${calc.tariefYear} tarief)`];
    }))),
    Object.assign({ key: 'total_calc_row', prop: 'TOPLAM', isTotal: true }, Object.fromEntries(cars.map(car => {
      const bpm = car.metrics?.bpmCalculation?.bpmCalculated;
      if (!bpm) return [car.listingId, null];
      return [car.listingId, (car.basePriceEuro || 0) + bpm];
    }))),
  ];

  const evaluationSource = [
    Object.assign({ key: 'age_row', prop: 'Yaş' }, Object.fromEntries(cars.map(car => [car.listingId, `${car.metrics?.ageInMonths || '?'} ay → €${car.metrics?.agePenalty?.toLocaleString() || '?'}`]))),
    Object.assign({ key: 'kmpen_row', prop: 'Kilometre' }, Object.fromEntries(cars.map(car => [car.listingId, `${car.mileageKm?.toLocaleString() || '?'} km → €${car.metrics?.mileagePenalty?.toLocaleString() || '?'}`]))),
    Object.assign({ key: 'depreciation_row', prop: 'Yıpranma' }, Object.fromEntries(cars.map(car => [car.listingId, `+€${car.metrics?.totalDepreciation?.toLocaleString() || '?'}`]))),
    Object.assign({ key: 'extfeat_row', prop: '− Donanım (beklenen dahil)' }, Object.fromEntries(cars.map(car => {
      const m = car.metrics || {};
      if (m.extraFeaturesValue == null) return [car.listingId, '?'];
      return [car.listingId, `−€${(m.extraFeaturesValue + (m.upsideGap || 0)).toLocaleString()}`];
    }))),
    Object.assign({ key: 'deal_score_row', prop: 'FIRSAT FİYATI', isDealScore: true }, Object.fromEntries(cars.map(car => [car.listingId, car.metrics?.expectedDealScore ?? car.metrics?.personalDealScore]))),
    Object.assign({ key: 'upside_row', prop: '🔍 Belirsiz Donanım' }, Object.fromEntries(cars.map(car => {
      const m = car.metrics || {};
      const cnt = m.unknownsCount || 0;
      if (!cnt) return [car.listingId, '—'];
      const parts = [`${cnt} kalem`];
      if (m.upsideGap != null) parts.push(`beklenen +€${m.upsideGap.toLocaleString()}`);
      if (m.unknownsPotentialValue != null) parts.push(`max +€${m.unknownsPotentialValue.toLocaleString()}`);
      return [car.listingId, parts.join(' • ')];
    }))),
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

  const sectionHeader = (label) => {
    const row = { key: `section_${label}`, prop: label, isSection: true };
    cars.forEach(car => { row[car.listingId] = ''; });
    return row;
  };

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
          : <Table dataSource={unifiedSource} columns={columns} pagination={false} size="small" scroll={{ x: 'max-content' }} rowHoverable={false} />}
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
