import React from 'react';
import { BrowserRouter, useSearchParams } from 'react-router-dom';
import { ConfigProvider, Layout, Flex, Switch, Typography, Select, Space, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { allByTotalCost } from './utils/pricingCalculator';
import { colorNamesByPreference, UI_COLORS } from './data';
import { carMatchesFilters } from './utils/carFilters';
import { PageHeader } from './components/PageHeader';
import { Recommendations } from './components/Recommendations';
import { MainTabs } from './components/MainTabs';

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
const KM_OPTS = [
  { value: 0, label: 'KM: hepsi' },
  { value: 30000, label: '< 30.000 km' },
  { value: 40000, label: '< 40.000 km' },
  { value: 50000, label: '< 50.000 km' },
  { value: 60000, label: '< 60.000 km' },
];
const GENERATION_OPTS = [
  { value: 'all', label: 'Nesil: hepsi' },
  { value: 'lci', label: '🔥 Sadece LCI (+olası)' },
];
const STAR_OPTS = [
  { value: 'all', label: 'Donanım: hepsi' },
  { value: '2', label: '⭐⭐ 2 Yıldız tam (+olası)' },
];

// Filtreler URL query'sinde tutulur — yenileme, geri/ileri ve tab değişiminde korunur, paylaşılabilir.
const AppContent = () => {
  const [params, setParams] = useSearchParams();
  const sortKey = params.get('sort') || 'price';
  const budgetMax = Number(params.get('budget')) || 0;
  const kmMax = Number(params.get('km')) || 0;
  const lciOnly = params.get('gen') === 'lci';
  const twoStarSure = params.get('star') === '2';
  const showDisliked = params.get('disliked') === '1';

  // Varsayılan değerde parametre URL'den silinir (temiz link); aksi halde yazılır.
  const setParam = (key, value, isDefault) => setParams(prev => {
    const next = new URLSearchParams(prev);
    if (isDefault) next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true });

  // Öneri paneli ve tablolar AYNI filtreli havuzu kullanır (tek kaynak) → tutarlı: bir araç öneride
  // görünüyorsa tabloda da bulunur; filtre-dışıysa ikisinde de yok. (C39 tutarsızlığının çözümü.)
  const filters = { showDisliked, kmMax, budgetMax, lciOnly, twoStarSure };
  const recPool = allByTotalCost.filter(c => carMatchesFilters(c, filters));

  return (
    <Layout style={{ background: '#f5f7fa', minHeight: '100vh' }}>
      <Content style={{ padding: '0 clamp(8px, 3vw, 24px)' }}>
        <Flex vertical gap="middle">

          <PageHeader />

          {/* Sabit filtre çubuğu — Select'ler responsive (mobilde genişler, masaüstünde yan yana) */}
          <Flex vertical gap={12}
            style={{ position: 'sticky', top: 0, zIndex: 20, padding: '16px 18px',
              background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(8px)',
              borderRadius: 16, border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px rgba(15,23,42,0.07)' }}>
            <Flex gap={10} wrap="wrap">
              <Select variant="filled" value={budgetMax} onChange={v => setParam('budget', v, !v)} options={BUDGET_OPTS} style={{ flex: '1 1 130px' }} />
              <Select variant="filled" value={kmMax} onChange={v => setParam('km', v, !v)} options={KM_OPTS} style={{ flex: '1 1 140px' }} />
              <Select variant="filled" value={lciOnly ? 'lci' : 'all'} onChange={v => setParam('gen', v, v === 'all')} options={GENERATION_OPTS} style={{ flex: '1 1 160px' }} />
              <Select variant="filled" value={twoStarSure ? '2' : 'all'} onChange={v => setParam('star', v, v === 'all')} options={STAR_OPTS} style={{ flex: '1 1 180px' }} />
            </Flex>
            <Flex align="center" gap={10} style={{ paddingTop: 2 }}>
              <Switch checked={showDisliked} onChange={v => setParam('disliked', '1', !v)} />
              <Text style={{ fontSize: 14, whiteSpace: 'nowrap' }}>👎 Sevilmeyen renkleri göster</Text>
              <Tooltip title={<span>Dış: {dislikedExt}<br />İç: {dislikedInt}</span>}>
                <InfoCircleOutlined style={{ color: '#94a3b8', fontSize: 14, cursor: 'help' }} />
              </Tooltip>
            </Flex>
          </Flex>

          <Recommendations evaluatedListings={recPool} />

          {/* Sıralama YALNIZCA aşağıdaki tabloları etkiler — öneri paneli kategori-bazlı kendi sıralamasını yapar. */}
          <Flex align="center" gap={10} wrap="wrap" style={{ padding: '0 2px' }}>
            <Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>↕ Tabloyu sırala</Text>
            <Select variant="filled" value={sortKey} onChange={v => setParam('sort', v, v === 'price')} options={SORT_OPTS} style={{ minWidth: 240 }} />
          </Flex>

          <MainTabs showDisliked={showDisliked} sortKey={sortKey} budgetMax={budgetMax} kmMax={kmMax} lciOnly={lciOnly} twoStarSure={twoStarSure} />
        </Flex>
      </Content>
    </Layout>
  );
};

const App = () => (
  <BrowserRouter>
    <ConfigProvider theme={{ token: { colorPrimary: UI_COLORS.link } }}>
      <AppContent />
    </ConfigProvider>
  </BrowserRouter>
);

export default App;
