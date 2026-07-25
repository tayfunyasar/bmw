import React from 'react';
import { Card, Typography, Space, Divider } from 'antd';
import { bookmarks, colorNamesByPreference } from '../../data';

const { Title, Text, Link } = Typography;

// Renk tercihleri COLORS.json'dan türetilir (hardcoded liste yok → drift olmaz).
const favColors = colorNamesByPreference('exterior', 'favorite').join(', ');
const dislikedColors = colorNamesByPreference('exterior', 'disliked').join(', ');
const dislikedInterior = colorNamesByPreference('interior', 'disliked').join(', ');

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
            <Text>⭐ </Text><Text strong style={{ color: '#52c41a' }}>Favori dış: </Text><Text>{favColors}</Text>
          </li>
          <li>
            <Text>👎 </Text><Text strong style={{ color: '#ff4d4f' }}>Sevilmeyen dış: </Text><Text>{dislikedColors}</Text>
          </li>
          <li>
            <Text>👎 </Text><Text strong style={{ color: '#ff4d4f' }}>Sevilmeyen iç (koltuk): </Text><Text>{dislikedInterior}</Text>
          </li>
        </ul>
      </div>
    </Space>
  </Card>
);
