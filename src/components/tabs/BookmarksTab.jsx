import React from 'react';
import { Card, Typography, Space, Divider } from 'antd';
import { bookmarks } from '../../data';

const { Title, Text, Link } = Typography;

export const BookmarksTab = () => (
  <Card title="🔖 Kontrol Edilecek Siteler & Bookmarklar">
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      <div>
        <Title level={5}>🔍 Arama Linkleri</Title>
        <ul style={{ listStyleType: 'disc', paddingLeft: 20 }}>
          {bookmarks.map((bookmark, index) => (
            <li key={index}>
              <Link href={bookmark.url} target="_blank">
                {bookmark.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <div>
        <Title level={5}>🎨 Renk Tercihleri</Title>
        <ul style={{ listStyleType: 'disc', paddingLeft: 20 }}>
          <li>
            <Text>⭐ </Text><Text strong style={{ color: '#52c41a' }}>Favori: </Text><Text>Tanzanit Blue / Tansanit Blue (II)</Text>
          </li>
          <li>
            <Text>👎 </Text><Text strong style={{ color: '#ff4d4f' }}>Favori değil: </Text><Text>Arctic Race Blue, San Remo Green, M Brooklyn Grau / Brooklyn Grau</Text>
          </li>
        </ul>
      </div>
    </Space>
  </Card>
);
