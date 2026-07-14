import React from 'react';
import { Typography, Space } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, QuestionCircleOutlined, StarFilled } from '@ant-design/icons';
import { isColorFav, isColorNotFav, isInteriorNotFav } from '../../data';

const { Text } = Typography;

export const FeatureIcon = ({ type }) => {
  if (type === "yes") return <Text type="success"><CheckCircleFilled /></Text>;
  if (type === "no") return <Text type="danger"><CloseCircleFilled /></Text>;
  return <Text type="warning"><QuestionCircleOutlined /></Text>;
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
    : <QuestionCircleOutlined style={{ fontSize: 22, color: '#999', flexShrink: 0 }} />
);

export const ColorDisplay = ({ colorCode, colorName }) => (
  <Space size={4}>
    {colorName ? <ColorSwatch colorCode={colorCode} /> : null}
    <Text>{colorName || "—"}</Text>
    {isColorFav(colorName) && <Text>⭐</Text>}
    {isColorNotFav(colorName) && <Text>👎</Text>}
  </Space>
);

// ⭐ = Alcantara koltuk. Kaynak: KGNL donanim kurali (description + props.upholstery
// birlikte taranir) — dosemenin adi guvenilmez oldugu icin renk adindan cikarilmaz.
export const InteriorDisplay = ({ colorCode, colorName, alcantara }) => (
  <Space size={4}>
    <ColorSwatch colorCode={colorCode} />
    <Text>{colorName}</Text>
    {alcantara && <Text>⭐</Text>}
    {isInteriorNotFav(colorName) && <Text>👎</Text>}
  </Space>
);
