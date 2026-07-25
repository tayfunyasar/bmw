import React, { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, Layout, Flex, Switch, Typography, Select } from 'antd';
import { allByTotalCost } from './utils/pricingCalculator';
import { hasDislikedColor, colorNamesByPreference, UI_COLORS } from './data';
import { PageHeader } from './components/PageHeader';
import { Recommendations } from './components/Recommendations';
import { MainTabs } from './components/MainTabs';
import { FrozenCarsProvider } from './components/FrozenCarsContext';

const { Content } = Layout;
const { Text } = Typography;

// Sevilmeyen renk özeti — COLORS.json'dan türer (hardcoded liste yok).
const dislikedExt = colorNamesByPreference('exterior', 'disliked').join(', ');
const dislikedInt = colorNamesByPreference('interior', 'disliked').join(', ');

const SORT_OPTS = [
  { value: 'price', label: '⇅ Toplam maliyet (ucuz→pahalı)' },
  { value: 'deal', label: '💎 Fırsat fiyatı (iyi→kötü)' },
  { value: 'km', label: '🛣️ Kilometre (az→çok)' },
  { value: 'score', label: '🏆 Genel skor (yüksek→düşük)' },
];
const BUDGET_OPTS = [
  { value: 0, label: 'Bütçe: hepsi' },
  { value: 60000, label: '≤ €60K' },
  { value: 66000, label: '≤ €66K' },
  { value: 72000, label: '≤ €72K' },
];

const App = () => {
  const [showDisliked, setShowDisliked] = useState(false);
  const [sortKey, setSortKey] = useState('price');
  const [budgetMax, setBudgetMax] = useState(0);

  // Öneri paneli: sadece renk filtresine tabi (sıralama/bütçe ana tablolarda).
  const recPool = showDisliked ? allByTotalCost : allByTotalCost.filter(c => !hasDislikedColor(c));

  return (
    <BrowserRouter>
      <ConfigProvider theme={{ token: { colorPrimary: UI_COLORS.link } }}>
        <FrozenCarsProvider initialIds={[]}>
          <Layout style={{ background: '#f5f7fa', minHeight: '100vh' }}>
            <Content style={{ padding: '0 clamp(8px, 3vw, 24px)' }}>
              <Flex vertical gap="middle">

                <PageHeader />

                {/* Sabit filtre çubuğu — renk · sıralama · bütçe */}
                <Flex align="center" gap="small" wrap="wrap"
                  style={{ position: 'sticky', top: 0, zIndex: 20, padding: '10px 12px',
                    background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(8px)',
                    borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <Select size="small" value={sortKey} onChange={setSortKey} options={SORT_OPTS} style={{ minWidth: 210 }} />
                  <Select size="small" value={budgetMax} onChange={setBudgetMax} options={BUDGET_OPTS} style={{ minWidth: 130 }} />
                  <Flex align="center" gap={6}>
                    <Text style={{ fontSize: 13 }}>🎨 Sevilmeyen renkler</Text>
                    <Switch checked={showDisliked} onChange={setShowDisliked} size="small" />
                  </Flex>
                  <Text type="secondary" style={{ fontSize: 11 }}>👎 {dislikedExt} · {dislikedInt}</Text>
                </Flex>

                <Recommendations evaluatedListings={recPool} />

                <MainTabs showDisliked={showDisliked} sortKey={sortKey} budgetMax={budgetMax} />
              </Flex>
            </Content>
          </Layout>
        </FrozenCarsProvider>
      </ConfigProvider>
    </BrowserRouter>
  );
};

export default App;
