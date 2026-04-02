import React from 'react';
import { Typography, Space } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, QuestionCircleOutlined, StarFilled } from '@ant-design/icons';
import { isColorFav, isColorNotFav } from '../../data';

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

export const ColorDisplay = ({ colorCode, colorName }) => (
  <Space size={4}>
    {colorName ? <div style={{ width: 28, height: 28, borderRadius: 6, background: colorCode, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} /> : null}
    <Text>{colorName || "—"}</Text>
    {isColorFav(colorName) && <Text>⭐</Text>}
    {isColorNotFav(colorName) && <Text>👎</Text>}
  </Space>
);

export const InteriorDisplay = ({ colorCode, colorName }) => (
  <Space size={4}>
    <div style={{ width: 28, height: 28, borderRadius: 6, background: colorCode, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
    <Text>{colorName}</Text>
  </Space>
);
