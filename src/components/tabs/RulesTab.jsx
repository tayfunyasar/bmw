import React from 'react';
import { Card, Typography, Space, Table } from 'antd';
import { bpmData, SCORING, UI_COLORS } from '../../data';

const { Title, Text, Link } = Typography;
// Skorlama sayıları tek kaynak SCORING.json'dan türetilir (metin ile kod drift'i biter).
const W = SCORING.weights, C = SCORING.color, B = SCORING.bonuses, P = SCORING.penalties;
const budgetK = Math.round(SCORING.budgetMax / 1000);
const spanK = Math.round((SCORING.budgetMax - SCORING.priceFloor) / 1000);

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
              <li>🏆 <Text type="warning" strong>Genel en iyi:</Text> Holistik skor — <Text italic>renk/arzu ağırlıklı</Text> genel favori</li>
              <li>💰 <Text type="success" strong>En iyi değer:</Text> <Text italic>Bang-for-buck</Text> — donanım€ / toplam maliyet€ oranı</li>
              <li>⚖️ <Text style={{ color: UI_COLORS.linkActive }} strong>Dengeli seçim:</Text> <Text italic>Hiçbir yönü zayıf değil</Text> — 4 boyutun geometrik ortalaması</li>
              <li>👑 <Text style={{ color: '#eb2f96' }} strong>En iyi donanım:</Text> En yüklü araç (<Text italic>donanımın € değeri</Text>) — fiyat önemsiz</li>
              <li>📉 <Text type="danger" strong>Fiyatı düşenler:</Text> Satıcı fiyat kırmış → <Text italic>motivasyonlu satıcı, pazarlık şansı</Text></li>
              <li><Text strong>Her kategori FARKLI bir algoritma kullanır</Text> → farklı araçlar önerir (aşağıda formüller)</li>
            </ul>
          </div>
          <div>
            <Title level={5}>Puanlama Kriterleri — <Text strong>Toplam Skor 0-100</Text> (çekirdek 100 + ek puanlar, clamp)</Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>4 çekirdek boyut (ağırlık toplam 100) + servis/garanti bonusu ve risk cezası.</Text>
            <ul style={{ paddingLeft: 20 }}>
              <li><Text type="success" strong>Fiyat ({W.price}%):</Text> <Text strong>Exact fiyat</Text> (TOPLAM = fiyat+BPM): (€{budgetK}K − fiyat) / €{spanK}K → <Text italic>ucuz = daha çok puan</Text> (sürekli, band değil). Düşük ağırlık; bütçe aşımı ayrı ceza (aşağı).</li>
              <li><Text type="warning" strong>Donanım ({W.equipment}%):</Text> Doğrulanmış + beklenen donanımın <Text strong>€ değeri</Text> / maksimum € (Laser/DAPRO/HK gibi pahalı kalemler daha çok puan). ✅ = tam, ❌ = 0, ? = base-rate ile kısmi</li>
              <li><Text style={{ color: UI_COLORS.linkActive }} strong>km / yaş ({W.kmAge}%):</Text> Düşük yıpranma (az km + yeni) = yüksek — dataset yüzdelik sırası (kare ile progresif)</li>
              <li><Text type="warning" strong>Arzu ({W.desirability}%):</Text> LCI facelift ({SCORING.lci}) + dış renk (favori {C.favorite} / nötr {C.neutral} / sevilmeyen {C.disliked}) + iç renk (favori {C.favorite} / nötr {C.neutral} / sevilmeyen {C.disliked})</li>
            </ul>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              <Text strong>Alcantara koltuk</Text> Arzu'da değil <Text strong>Donanım'da</Text> puanlanır (KGNL, 900€ ×2) — <Text italic>çift sayım olmasın diye</Text>. Tespit: açıklama <Text strong>VEYA</Text> döşeme alanı (<Text code>upholstery</Text>); bayiler döşemeyi sık sık yanlış işaretlediği için ikisi de taranır. ⭐ ikonu bu kuraldan gelir.
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>Ek puanlar: <Text strong>Tam servis +{B.service}</Text> (belgesiz/? ceza YEMEZ), <Text strong>Garanti +{B.warranty}</Text>; <Text type="danger">Özel satıcı −{P.private}, Aftermarket −{P.aftermarket}, Bütçe aşımı (&gt;€{budgetK}K) −{P.overBudget}</Text>.</Text>
          </div>
          <div>
            <Title level={5}>Seçim Kuralları</Title>
            <ul style={{ paddingLeft: 20 }}>
              <li>🏆 <Text strong>Genel:</Text> fiyat×{W.price} + donanım×{W.equipment} + km/yaş×{W.kmAge} + <Text strong>arzu×{W.desirability}</Text> + bonus − ceza</li>
              <li>💎 <Text strong>Gerçek Fırsat:</Text> düzeltilmiş net maliyet (donanım düşülmüş) <Text type="secondary">— düşük=iyi</Text></li>
              <li>💰 <Text strong>Değer:</Text> <Text strong>(donanım€ / toplam maliyet€) × 100</Text> + bonus − ceza <Text type="secondary">(bang-for-buck oranı)</Text></li>
              <li>🔍 <Text strong>Gizli Değer:</Text> belgelenmemiş donanım potansiyeli <Text type="secondary">(bayi linkiyle çözülecek)</Text></li>
              <li>👑 <Text strong>Donanım:</Text> beklenen donanımın <Text strong>€ değeri</Text> (fiyat/renk hiç sayılmaz)</li>
              <li>📉 <Text strong>Fiyat düşüşü:</Text> auditHistory'deki toplam € kırım (bütçe içi araçlarda) <Text type="secondary">— çok/sık düşüren = motivasyonlu</Text></li>
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