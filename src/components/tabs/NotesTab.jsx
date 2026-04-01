import React from 'react';
import { Card, Typography, Space, List } from 'antd';
import { vehicleNotes, actionPlan } from '../../data';

const { Title, Text, Link } = Typography;

export const NotesTab = () => (
  <Space direction="vertical" size="large" style={{ display: 'flex' }}>
    <Card title="⏳ Bekleyen İlanlar">
      <Text type="warning">• Şu an bekleyen ilan yok</Text>
    </Card>

    <Card title="📞 Yapılacaklar & Aksiyon Planı">
      <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
        <div style={{ padding: 12, backgroundColor: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 4 }}>
          <Title level={5} type="danger">🔥 #1 ÖNCELİK — {actionPlan.priority.title}</Title>
          <ul style={{ paddingLeft: 20 }}>
            <li><Text type="warning" strong>📅 {actionPlan.priority.date}</Text> — {actionPlan.priority.action}</li>
            {actionPlan.priority.questions.map((q, i) => (
              <li key={i}><Text type="danger" strong>Sorulacak #{i + 1}:</Text> {q}</li>
            ))}
            <li><Text type="success" strong>Güçlü yönler:</Text> {actionPlan.priority.strengths}</li>
            <li><Text type="secondary">Araç no:</Text> <Text code>{actionPlan.priority.vehicleNo}</Text></li>
            <li><Text type="secondary">Bayi linki:</Text> <Link href={actionPlan.priority.dealerLink} target="_blank">bmw.de</Link></li>
          </ul>
        </div>

        <div>
          <Title level={5} type="danger">Diğer Aksiyonlar</Title>
          <ul style={{ paddingLeft: 20 }}>
            {actionPlan.otherActions.map((action, i) => (
              <li key={i}>
                <Text type="warning" strong>{action.car}</Text> — {action.action}
                {action.link && <> <Link href={action.link} target="_blank">mobile.de</Link></>}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Title level={5} type="danger">📧 {actionPlan.email.title}</Title>
          <div style={{ padding: 12, backgroundColor: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 4, whiteSpace: 'pre-line' }}>
            {actionPlan.email.body}
          </div>
        </div>
      </Space>
    </Card>

    <Card title="📝 Araç Notları (Tabloda olmayan ekstra bilgiler)">
      <List
        size="small"
        bordered
        dataSource={vehicleNotes}
        renderItem={(item) => (
          <List.Item>
            <div style={{ width: '100%' }}>
              <div style={{ color: item.hex, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
              <div>
                {item.content.map((line, i) => (
                  <div key={i}>• {line}</div>
                ))}
              </div>
            </div>
          </List.Item>
        )}
      />
    </Card>
  </Space>
);
