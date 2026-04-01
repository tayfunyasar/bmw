import React from 'react';
import { List, Typography } from 'antd';

const { Link } = Typography;

export const SimpleCarList = ({ dataSource }) => (
  <List
    size="small"
    dataSource={dataSource}
    renderItem={(item) => (
      <List.Item>
        <div>
          • {item.link ? <Link href={item.link} target="_blank" style={{ color: item.hex, fontWeight: 500 }}>{item.label}</Link> : <span style={{ color: item.hex, fontWeight: 500 }}>{item.label}</span>} {item.detail}
        </div>
      </List.Item>
    )}
  />
);
