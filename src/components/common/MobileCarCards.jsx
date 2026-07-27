import React from 'react';
import { Card, Flex, Typography, Space, Tag, Tooltip } from 'antd';
import { equipmentRules, UI_COLORS, getColorHex, getInteriorHex } from '../../data';
import { ColorDisplay, InteriorDisplay, FeatureIcon } from './Icons';
import { FreezeButton } from './FreezeButton';
import { formatNotes } from '../../utils/helpers';

const { Text, Link } = Typography;

const euro = (v) => (v == null ? '—' : `€${Math.round(v).toLocaleString('tr-TR')}`);

// Kritik donanımlar (score>0) — kartta ikon şeridi olarak gösterilir.
const KEY_FEATURES = equipmentRules.filter(r => r.score > 0).sort((a, b) => (b.price * b.score) - (a.price * a.score));

// Hibrit tasarımın MOBİL yüzü: her araç dikey bir kart (transpoze tablo yerine).
// Aynı veri; masaüstünde CarTable'ın tablosu, mobilde bu kartlar gösterilir.
export const MobileCarCards = ({ cars, isRejected = false, rejectedLabel = 'RED' }) => {
  return (
    <Flex vertical gap={12}>
      {cars.map(car => {
        const m = car.metrics || {};
        const bpm = m.bpmCalculation?.bpmCalculated;
        const total = bpm != null ? (car.basePriceEuro || 0) + bpm : null;
        const deal = m.expectedDealScore ?? m.personalDealScore;
        const [ry, rm] = car.firstRegistrationYearAndMonth || [];
        const reg = (ry != null && rm != null) ? `${String(rm).padStart(2, '0')}/${ry}` : '?';
        return (
          <Card key={car.listingId} size="small" styles={{ body: { padding: 14 } }}
            style={{ borderColor: car.curatorPickBadge && !isRejected && !car.isSold ? UI_COLORS.statusFresh : undefined }}>
            {/* Başlık: id + rozet + favori */}
            <Flex justify="space-between" align="flex-start" gap={8}>
              <Flex vertical gap={2}>
                <Space size={6} wrap>
                  <Link href={car.listingUrl} target="_blank" strong delete={isRejected || car.isSold} style={{ fontSize: 16 }}>
                    {car.listingId}
                  </Link>
                  {car.listingLocation && <Text type="secondary" style={{ fontSize: 12 }}>{car.listingLocation}</Text>}
                </Space>
                <Space size={4} wrap>
                  {isRejected && <Tag color="error" style={{ margin: 0 }}>{rejectedLabel}</Tag>}
                  {car.isSold && !isRejected && <Tag color="error" style={{ margin: 0 }}>SATILDI</Tag>}
                  {car.curatorPickBadge && !isRejected && !car.isSold && <Text>{car.curatorPickBadge}</Text>}
                  {car.modelGenerationCertain === false
                    ? <Tooltip title="LCI/Pre-LCI belirsiz — 01–05/2023 geçiş döneminde iki nesil birlikte tescil edildi. Foto ile teyit gerek."><Tag style={{ margin: 0 }}>⚠️ LCI?</Tag></Tooltip>
                    : car.modelGeneration === 'LCI' && <Tag color="warning" style={{ margin: 0 }}>🔥 LCI</Tag>}
                </Space>
              </Flex>
              <FreezeButton listingId={car.listingId} />
            </Flex>

            {/* Fiyat bloğu */}
            <Flex gap={16} wrap style={{ marginTop: 10 }}>
              <Flex vertical>
                <Text type="secondary" style={{ fontSize: 11 }}>Fiyat / Toplam</Text>
                <Text strong style={{ fontSize: 18 }}>{euro(car.basePriceEuro)}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{total != null ? `${euro(total)} (+BPM)` : ''}</Text>
              </Flex>
              <Flex vertical style={{ padding: '2px 10px', borderRadius: 8, background: 'rgba(82,196,26,0.08)' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>💎 Fırsat fiyatı</Text>
                <Text strong style={{ fontSize: 18, color: UI_COLORS.statusFresh }}>{euro(deal)}</Text>
              </Flex>
            </Flex>

            {/* Meta: km, tescil, renk */}
            <Flex vertical gap={4} style={{ marginTop: 10, fontSize: 13 }}>
              <Flex gap={12} wrap>
                <Text>🛣️ {car.mileageKm?.toLocaleString('tr-TR')} km</Text>
                <Text type="secondary">📅 {reg}</Text>
                <Text type="secondary">👤 {car.numberOfPreviousOwners} sahip</Text>
              </Flex>
              <Flex gap={12} wrap align="center">
                <ColorDisplay colorCode={getColorHex(car.exteriorColorName)} colorName={car.exteriorColorName} paintLabel={car.exteriorPaintLabel} />
                <InteriorDisplay colorCode={getInteriorHex(car.interiorColorName)} colorName={car.interiorColorName} alcantara={car.equipmentFeatures?.KGNL === 'yes'} />
              </Flex>
              <Text>⚙️ {car.drivetrainType} {car.drivetrainCertain === false ? '⚠️' : '✅'}</Text>
            </Flex>

            {/* Donanım ikon şeridi (tooltip'li) */}
            <Flex gap={6} wrap style={{ marginTop: 10 }}>
              {KEY_FEATURES.map(f => (
                <Space key={f.code} size={3} style={{ fontSize: 12 }}>
                  <FeatureIcon type={car.equipmentFeatures?.[f.code]} name={f.name} />
                </Space>
              ))}
            </Flex>

            {/* Notlar (uzun olanlar hover/dokunuşla açılır) */}
            {[['📝', car.listingDescriptionNotes], ['💭', car.curatorPersonalNotes], ['🤖', car.aiCommentary]]
              .filter(([, n]) => Array.isArray(n) && n.length)
              .map(([icon, n], i) => (
                <Flex key={i} gap={6} style={{ marginTop: 8, fontSize: 12.5 }}>
                  <Text>{icon}</Text><Text style={{ flex: 1 }}>{formatNotes(n)}</Text>
                </Flex>
              ))}
          </Card>
        );
      })}
    </Flex>
  );
};
