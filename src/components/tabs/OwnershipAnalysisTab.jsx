import React, { useMemo, useState } from 'react';
import { Alert, Card, Col, Flex, Row, Segmented, Statistic, Table, Tag, Typography } from 'antd';
import { analyzeOwnership, OWNERSHIP_DEFAULTS } from '../../utils/ownershipAnalysis';

const { Text, Title, Link } = Typography;
const eur = (value) => `€${Math.round(value).toLocaleString('tr-TR')}`;
const km = (value) => `${Math.round(value).toLocaleString('tr-TR')} km`;
const confidence = { high: ['Yüksek', 'success'], medium: ['Orta', 'warning'], low: ['Düşük', 'error'] };

export const OwnershipAnalysisTab = ({ candidates, referencePool }) => {
  const [annualKm, setAnnualKm] = useState(OWNERSHIP_DEFAULTS.annualKm);
  const analysis = useMemo(
    () => analyzeOwnership(candidates, referencePool, { annualKm }),
    [candidates, referencePool, annualKm],
  );
  const best = analysis.results[0];
  const criteria = analysis.criteria;

  const columns = [
    { title: '#', width: 42, render: (_, __, i) => i + 1 },
    { title: 'Araç', render: (_, x) => <Link href={x.car.listingUrl} target="_blank" strong>{x.car.listingId}</Link> },
    { title: 'Model', render: (_, x) => x.car.firstRegistrationYearAndMonth?.join('/') },
    { title: 'Bugün', render: (_, x) => `${km(x.car.mileageKm)} · ${eur(x.car.metrics.baseTotalCost)}` },
    { title: '15 ay sonra', render: (_, x) => `${km(x.futureMileageKm)} · ${eur(x.conservativeResaleValue)}` },
    { title: 'Değer kaybı', sorter: (a, b) => a.depreciationCost - b.depreciationCost,
      render: (_, x) => <Text strong type={x.depreciationCost <= 5000 ? 'success' : 'danger'}>{eur(x.depreciationCost)} · %{x.depreciationPercent}</Text> },
    { title: 'Güven', render: (_, x) => { const [label, color] = confidence[x.confidence]; return <Tag color={color}>{label} · ±{eur(x.uncertaintyEuro)}</Tag>; } },
    { title: 'Emsaller', render: (_, x) => x.neighborIds.slice(0, 5).join(', ') },
  ];

  if (!best || !criteria) return <Alert type="info" showIcon message="Analiz için yeterli temiz ve aktif araç bulunamadı." />;

  return (
    <Flex vertical gap="middle">
      <Alert type="success" showIcon
        message={`Minimum değer kaybı adayı: ${best.car.listingId} — tahmini ${eur(best.depreciationCost)} (%${best.depreciationPercent})`}
        description="Tescil tarihi ve kilometresi doğrulanmış temiz araçlar hesaplanır; ilan havuzu değiştikçe yaş/km emsalleri ve sonuç otomatik güncellenir." />

      <Card size="small">
        <Flex justify="space-between" align="center" wrap gap="small">
          <div>
            <Title level={4} style={{ margin: 0 }}>15 Aylık Sahiplik ve Yeniden Satış</Title>
            <Text type="secondary">Yıllık kullanım varsayımı</Text>
          </div>
          <Segmented value={annualKm} onChange={setAnnualKm} options={[
            { label: '10.000 km/yıl', value: 10000 },
            { label: '15.000 km/yıl', value: 15000 },
            { label: '20.000 km/yıl', value: 20000 },
          ]} />
        </Flex>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Optimal model yılı bandı" value={criteria.yearMin === criteria.yearMax ? criteria.yearMedian : `${criteria.yearMin}–${criteria.yearMax}`} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Optimal alış km bandı" value={`${Math.round(criteria.kmMin / 1000)}–${Math.round(criteria.kmMax / 1000)} bin`} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Medyan ilan fiyatı" value={criteria.priceMedian} prefix="€" groupSeparator="." /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Medyan toplam maliyet" value={criteria.totalCostMedian} prefix="€" groupSeparator="." /></Card></Col>
      </Row>

      <Table rowKey={x => x.car.listingId} columns={columns} dataSource={analysis.results} pagination={{ pageSize: 15 }} scroll={{ x: 980 }} size="small" />

      <Alert type="warning" showIcon message="Tahminin sınırları"
        description={`${analysis.referenceCount} tescil tarihi ve km'si geçerli temiz aktif/satılmış ilan emsal alındı. Optimal bant, en iyi tahminin €5.000 yakınındaki güvenilir adaylardan çıkarılır. Değer, en yakın 9 yaş/km emsalinin BPM dâhil toplam maliyetinden; donanım farkının %25'i, satışta %3 pazarlık payı ve standart 15 bin km/yılın dışındaki kullanım için €0,18/km düzeltme uygulanarak hesaplanır. İlan fiyatları gerçek noter satış fiyatı değildir; ± bandı emsallerin dağılımını gösterir.`} />
    </Flex>
  );
};
