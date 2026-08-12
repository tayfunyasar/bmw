import React from 'react';
import { Typography, Space, Tooltip } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, QuestionCircleOutlined, StarFilled } from '@ant-design/icons';
import { isColorFav, isColorNotFav, isInteriorNotFav, UI_COLORS } from '../../data';
import { equipmentNameOf } from '../../utils/listingDiff';

const { Text } = Typography;

// Durum sozlugu — hem ikon secimi hem tooltip metni buradan.
const STATUS = {
  yes: { el: <CheckCircleFilled />, tone: 'success', txt: '✅ var' },
  no: { el: <CloseCircleFilled />, tone: 'danger', txt: '❌ yok' },
  unknown: { el: <QuestionCircleOutlined />, tone: 'warning', txt: '❓ belirsiz — bayi linkiyle çözülür' },
};

// Karar gerekcesi tasiyan kayit alanlari (kod -> alan adi). Yeni gerekce alani
// eklenirse (or. dapReason) yalnizca bu tabloya satir eklenir — cagiranlar degismez.
const REASON_FIELDS = { S403A: 'sunroofReason' };

// Donanim durum ikonu. Sozlesme: aracin KAYDI + donanim KODU verilir; durum, ad,
// celiski ve karar gerekcesi buradan turetilir. Cagiran taraf kaydin ic yapisini
// (equipmentConflicts, sunroofReason...) BILMEZ.
export const FeatureIcon = ({ car, code }) => {
  const status = STATUS[car?.equipmentFeatures?.[code]] ?? STATUS.unknown;
  const conflict = car?.equipmentConflicts?.[code] ?? null;
  const reason = car?.[REASON_FIELDS[code]] ?? null;

  const titleParts = [
    `${equipmentNameOf(code)} — ${status.txt}`,
    reason,
    conflict && `⚠️ KAYNAKLAR ÇELİŞİYOR: ${Object.entries(conflict)
      .map(([src, st]) => `${src}: ${STATUS[st]?.txt ?? st}`).join(' · ')} — teyit gerekli`,
  ].filter(Boolean);

  return (
    <Tooltip title={titleParts.join(' · ')}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <Text type={status.tone}>{status.el}</Text>
        {conflict && <span style={{ position: 'absolute', top: -7, right: -7, fontSize: 10, lineHeight: 1 }}>⚠️</span>}
      </span>
    </Tooltip>
  );
};

export const StarRating = ({ count }) => (
  <Space size={2}>
    {Array.from({ length: count }).map((_, index) => <Text type="warning" key={index}><StarFilled /></Text>)}
  </Space>
);

// A known color renders its swatch; an unknown one (colorCode == null) renders
// a "?" icon instead of a misleading gray box.
const ColorSwatch = ({ colorCode }) => (
  colorCode
    ? <div style={{ width: 28, height: 28, borderRadius: 6, background: colorCode, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
    : <QuestionCircleOutlined style={{ fontSize: 22, color: UI_COLORS.muted, flexShrink: 0 }} />
);

// compact: dar kartlarda uzun renk adı tek satıra kısaltılır (tam ad tooltip'te).
// paintLabel: üretici boya etiketi (ham) — varsa renk adıyla BİRLEŞİK gösterilir: "Blue · BMW Individuallackierung".
export const ColorDisplay = ({ colorCode, colorName, paintLabel, compact = false }) => {
  const fullName = paintLabel ? `${colorName || "—"} · ${paintLabel}` : (colorName || "—");
  return (
    <Space size={4} style={compact ? { maxWidth: '100%' } : undefined}>
      {colorName ? <ColorSwatch colorCode={colorCode} /> : null}
      {compact
        ? <Tooltip title={fullName}><Text style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom' }}>{fullName}</Text></Tooltip>
        : <Text>{fullName}</Text>}
      {isColorFav(colorName) && <Tooltip title="Favori dış renk — skorda +7.5"><Text>⭐</Text></Tooltip>}
      {isColorNotFav(colorName) && <Tooltip title="Sevilmeyen dış renk — skorda −15"><Text>👎</Text></Tooltip>}
    </Space>
  );
};

// ⭐ = Alcantara koltuk. Kaynak: KGNL donanim kurali (description + props.upholstery
// birlikte taranir) — dosemenin adi guvenilmez oldugu icin renk adindan cikarilmaz.
export const InteriorDisplay = ({ colorCode, colorName, alcantara }) => (
  <Space size={4}>
    <ColorSwatch colorCode={colorCode} />
    <Text>{colorName}</Text>
    {alcantara && <Tooltip title="Alcantara koltuk — Donanım'da puanlanır (KGNL), Arzu'da değil"><Text>⭐</Text></Tooltip>}
    {isInteriorNotFav(colorName) && <Tooltip title="Sevilmeyen iç renk (kırmızı/kahve) — skorda −15"><Text>👎</Text></Tooltip>}
  </Space>
);
