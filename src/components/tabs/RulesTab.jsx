import React from 'react';
import { Card, Typography, Space, Table } from 'antd';
import { bpmData } from '../../data';

const { Title, Text, Link } = Typography;

export const RulesTab = () => {
  const bpmColumns = [
    { title: 'Nesil', dataIndex: 'gen', key: 'gen' },
    { title: 'CO₂', dataIndex: 'co2', key: 'co2' },
    { title: 'Tescil', dataIndex: 'reg', key: 'reg' },
    { title: 'Aangifte', dataIndex: 'aangifte', key: 'aangifte' },
    { title: 'BPM', dataIndex: 'bpm', key: 'bpm', render: (text) => <Text type="danger" strong>{text}</Text> },
    { title: 'Kaynak', dataIndex: 'source', key: 'source', render: (text) => <Text type="secondary">{text}</Text> },
  ];

  return (
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      <Card title="📋 Kurallar & Metodoloji">
        <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
          <div>
            <Title level={5}>Filtreleme & Sıralama</Title>
            <ul style={{ paddingLeft: 20 }}>
              <li>Araçlar <Text type="warning">fiyat sırasına</Text> göre (ucuzdan pahalıya) listelenir.</li>
              <li><Text type="danger" strong>CAM TAVAN ŞARTI:</Text> Sunroof NO → otomatik red.</li>
              <li><Text type="danger" strong>MALİYET LİMİTİ:</Text> Toplam Maliyet (Fiyat + BPM) max €63,000.</li>
              <li><Text type="danger" strong>xDRIVE ŞARTI:</Text> RWD araçlar tabloya eklenmez, sadece xDrive (AWD).</li>
              <li>Link paylaşılınca araç otomatik eklenir (onay gerekmez).</li>
              <li>İlan linkleri sadece CX başlık kısmında gösterilir, mobile.de tercih edilir.</li>
            </ul>
          </div>

          <div>
            <Title level={5}>Terimler</Title>
            <ul style={{ paddingLeft: 20 }}>
              <li><Text type="warning" strong>Fiyat:</Text> Satıcının istediği tutar (asking price)</li>
              <li><Text type="warning" strong>BPM:</Text> Hollanda ithalat vergisi (🇩🇪→🇳🇱). NL araçlarda €0</li>
              <li><Text type="warning" strong>Toplam Maliyet:</Text> Fiyat + BPM</li>
              <li><Text type="warning" strong>Yıpranma Bedeli:</Text> ay × €138 + km × €0.092 (+15% güvenlik payı)</li>
              <li><Text type="success" strong>Donanım Değeri:</Text> ⭐⭐ = fiyat × 2, ⭐ ve diğer = fiyat × 1</li>
              <li><Text type="success" strong>Düzeltilmiş Maliyet:</Text> Toplam Maliyet + Yıpranma − Donanım Değeri (düşük = iyi)</li>
            </ul>
          </div>

          <div>
            <Title level={5}>Yıldız Sistemi</Title>
            <ul style={{ paddingLeft: 20 }}>
              <li><Text type="warning" strong>⭐⭐ Cam Tavan:</Text> GATE — olmazsa olmaz</li>
              <li><Text type="warning" strong>⭐ Kritik:</Text> Warranty, Laser, DA+, HK, M Diff, HUD, 360cam</li>
              <li>Max yıldız: 8 (2+1+1+1+1+1+1+1)</li>
            </ul>
          </div>
        </Space>
      </Card>

      <Card title="🇳🇱 BPM Referans Tablosu">
        <div style={{ marginBottom: 12 }}>
          <Link href="https://www.autoweek.nl/bpmcalculator/calculator/?datum_eerste_toelating=01-01-2024&datum_aangifte=07-03-2026&prijs=94304&netto=0&brandstof=1&motorisering=1&energielabel=F&roetfilter=0&version_id=109009&co2_wltp=175" target="_blank">
            🔗 Autoweek BPM Calculator
          </Link>
        </div>
        <Table dataSource={bpmData} columns={bpmColumns} pagination={false} size="small" bordered />
      </Card>

      <Card title="🎯 Öneri Algoritması">
        <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
          <div>
            <Title level={5}>Kategoriler</Title>
            <ul style={{ paddingLeft: 20 }}>
              <li>🏆 <Text type="warning" strong>Top Pick:</Text> Genel en iyi seçim — tüm faktörler dengeli</li>
              <li>💰 <Text type="success" strong>Budget Pick:</Text> En düşük toplam maliyetle en iyi değer</li>
              <li>⚖️ <Text style={{ color: '#1677ff' }} strong>Balanced Pick:</Text> Fiyat/donanım dengesi en iyi</li>
              <li>👑 <Text style={{ color: '#eb2f96' }} strong>Best Spec:</Text> Donanım açısından en zengin</li>
            </ul>
          </div>
          <div>
            <Title level={5}>Puanlama Kriterleri (ağırlıklı)</Title>
            <ul style={{ paddingLeft: 20 }}>
              <li><Text type="warning" strong>Donanım skoru (30%):</Text> Kritik donanım sayısı (Laser, DA+, HK, M Diff, HUD, 360°). Her ✅ = +1, her ❌ = 0, ? = +0.3 (yazılmamışsa büyük ihtimal yok)</li>
              <li><Text type="success" strong>Fiyat/değer (25%):</Text> Toplam maliyet (fiyat+BPM) ne kadar düşükse o kadar iyi. Düzeltilmiş maliyet formülü kullanılır</li>
              <li><Text style={{ color: '#1677ff' }} strong>Güvenilirlik (20%):</Text> 1 sahip (+3), tam servis (+2), kazasızlık (+2), bayi puanı (★×1), düşük km (+1 per 10K altı ortalama)</li>
              <li><Text style={{ color: '#eb2f96' }} strong>Risk faktörleri (15%):</Text> Özel satıcı (-2), aftermarket modifikasyon (-2), yabancı ülke ithalatı (-1)</li>
              <li><Text type="warning" strong>Bonus (10%):</Text> LCI nesil (+2), Pre-Heater (+2), M Brake (+1), aktif garanti (+2), nadir/güzel dış renk (+1), Alcantara/renkli iç mekan (+1), siyah iç mekan (0), bilinmeyen iç (-0.5)</li>
            </ul>
          </div>
          <div>
            <Title level={5}>Seçim Kuralları</Title>
            <ul style={{ paddingLeft: 20 }}>
              <li>🏆 Top Pick: En yüksek toplam puan. Ciddi risk faktörü varsa seçilmez</li>
              <li>💰 Budget: Toplam maliyet €57K altı + en iyi güvenilirlik/donanım oranı</li>
              <li>⚖️ Balanced: Donanım skoru ≥4/7 kritik + toplam maliyet ≤€58K</li>
              <li>👑 Best Spec: En yüksek donanım skoru (fiyat önemsiz, sadece donanım)</li>
              <li>Bir araç birden fazla kategori alabilir (ör. 🏆💰)</li>
              <li>Her yeni araç eklendiğinde tüm kategoriler yeniden değerlendirilir</li>
            </ul>
          </div>
        </Space>
      </Card>

      <Card title="🔒 Meta Kurallar">
        <ul style={{ paddingLeft: 20 }}>
          <li><Text type="danger" strong>EKSİKSİZLİK:</Text> Chatte konuşulan her şey bu dosyada olmalı.</li>
          <li><Text type="danger" strong>CAM TAVAN ŞARTI:</Text> Sunroof NO → otomatik red.</li>
          <li><Text type="danger" strong>MALİYET LİMİTİ:</Text> Toplam Maliyet max €63,000.</li>
          <li><Text type="danger" strong>xDRIVE ŞARTI:</Text> RWD araçlar asla tabloya eklenmez. Sadece xDrive.</li>
          <li><Text type="danger" strong>COUPÉ ŞARTI:</Text> Sadece 2 kapı Coupé (G22). Gran Coupé (G26, 4 kapı) kabul edilmez.</li>
          <li><Text type="warning" strong>OTOMATİK EKLEME:</Text> Link paylaşılınca onay gerekmez.</li>
          <li><Text type="warning" strong>FİYAT SIRALAMA:</Text> Her zaman ucuzdan pahalıya.</li>
          <li><Text type="warning" strong>YILDIZ SİSTEMİ:</Text> ⭐⭐ Cam Tavan (×2). ⭐ diğer kritik (×1).</li>
          <li><Text type="warning" strong>LİNK FORMATI:</Text> Linkler sadece CX başlığında. mobile.de tercih edilir.</li>
          <li><Text type="warning" strong>TEKRAR TARAMA:</Text> Aynı link tekrar gönderilirse ilanı tekrar fetch et.</li>
          <li><Text type="warning" strong>FİYAT DEĞİŞİMİ:</Text> Fiyat değiştiyse audit'e kaydet — pazarlık fırsatı!</li>
          <li><Text type="warning" strong>ŞÜPHELİ RED:</Text> Alışılmadık red sebeplerinde (dizel vb.) kullanıcıya sor.</li>
        </ul>
      </Card>
      


      <Card title="📝 Notlar">
        <ul style={{ paddingLeft: 20 }}>
          <li><Text type="warning" strong>?</Text> = bilinmiyor, satıcıyla doğrulayın</li>
          <li>Ayrı M240i xDrive Coupé (G42) karşılaştırma tablosu da mevcut (3 araç, hepsi NL)</li>
        </ul>
      </Card>
    </Space>
  );
};