import React from 'react';
import { Card, Typography, Space } from 'antd';
import { emails } from '../../data';

const { Title, Text } = Typography;

// Mail arşivi — tek kaynak user_data/EMAILS.json.
// Taslaklar üstte (aksiyon bekleyenler), gönderilmişler ve yanıtlananlar altta.
const STATUS_STYLE = {
  draft: { label: '📝 TASLAK', bg: '#f0f5ff', border: '#adc6ff' },
  sent: { label: '📤 GÖNDERİLDİ', bg: '#f6ffed', border: '#b7eb8f' },
  answered: { label: '✅ YANITLANDI', bg: '#f9f0ff', border: '#d3adf7' },
};
const STATUS_ORDER = { draft: 0, sent: 1, answered: 2 };

const MailCard = ({ mail }) => {
  const style = STATUS_STYLE[mail.status] || STATUS_STYLE.draft;
  return (
    <div>
      <Title level={5} style={{ marginBottom: 4 }}>
        {style.label} — {mail.listingId} · {mail.dealer}
      </Title>
      <ul style={{ paddingLeft: 20, marginBottom: 8 }}>
        <li><Text type="secondary">Konu:</Text> <Text code>{mail.subject}</Text></li>
        {mail.to?.length > 0 && <li><Text type="secondary">Kime:</Text> {mail.to.join(', ')}</li>}
        {mail.cc?.length > 0 && <li><Text type="secondary">CC:</Text> {mail.cc.join(', ')}</li>}
        {mail.whatsapp && <li><Text type="secondary">WhatsApp:</Text> <Text code>{mail.whatsapp}</Text></li>}
        {mail.sentDate && <li><Text type="secondary">Gönderim:</Text> {mail.sentDate}</li>}
        {mail.note && <li><Text type="warning">{mail.note}</Text></li>}
      </ul>
      <div style={{ padding: 12, backgroundColor: style.bg, border: `1px solid ${style.border}`, borderRadius: 4, whiteSpace: 'pre-wrap', fontSize: 13 }}>
        {mail.body}
      </div>
    </div>
  );
};

export const EmailsTab = () => {
  const sorted = [...emails.emails].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
  );
  return (
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      <Card title="📇 İletişim">
        <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
          <li><Text type="secondary">Ad:</Text> {emails.contact.name}</li>
          <li><Text type="secondary">E-posta:</Text> <Text code>{emails.contact.email}</Text></li>
          <li><Text type="secondary">Cep{emails.contact.whatsapp ? ' / WhatsApp' : ''}:</Text> <Text code>{emails.contact.mobile}</Text></li>
        </ul>
      </Card>

      <Card title={`📧 Mailler — ${sorted.length} kayıt`}>
        <Space direction="vertical" size="large" style={{ display: 'flex' }}>
          {sorted.map(mail => <MailCard key={mail.id} mail={mail} />)}
        </Space>
      </Card>

      <Card title="🔁 Her maile eklenen kriterler">
        <div style={{ padding: 12, backgroundColor: '#fafafa', border: '1px solid #d9d9d9', borderRadius: 4, whiteSpace: 'pre-wrap', fontSize: 13 }}>
          {emails.criteriaSuffix}
        </div>
      </Card>
    </Space>
  );
};
