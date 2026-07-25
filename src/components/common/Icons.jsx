import React from 'react';
import { Typography, Space, Tooltip } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, QuestionCircleOutlined, StarFilled } from '@ant-design/icons';
import { isColorFav, isColorNotFav, isInteriorNotFav, UI_COLORS } from '../../data';

const { Text } = Typography;

// name (donanım adı) verilirse ikon tooltip'te "Ad — durum" gösterir.
export const FeatureIcon = ({ type, name }) => {
  const s = type === "yes" ? { el: <CheckCircleFilled />, t: "success", txt: "Var ✅" }
    : type === "no" ? { el: <CloseCircleFilled />, t: "danger", txt: "Yok ❌" }
    : { el: <QuestionCircleOutlined />, t: "warning", txt: "Belirsiz — bayi linkiyle çözülür" };
  const title = name ? `${name} — ${s.txt}` : s.txt;
  return <Tooltip title={title}><Text type={s.t}>{s.el}</Text></Tooltip>;
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

export const ColorDisplay = ({ colorCode, colorName }) => (
  <Space size={4}>
    {colorName ? <ColorSwatch colorCode={colorCode} /> : null}
    <Text>{colorName || "—"}</Text>
    {isColorFav(colorName) && <Tooltip title="Favori dış renk — skorda +7.5"><Text>⭐</Text></Tooltip>}
    {isColorNotFav(colorName) && <Tooltip title="Sevilmeyen dış renk — skorda −15"><Text>👎</Text></Tooltip>}
  </Space>
);

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
