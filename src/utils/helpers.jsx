import React from 'react';
import { Tooltip, Typography } from 'antd';
import FEATURE_PRICES from '../data/metadata/FEATURE_PRICES.json';

const { Text } = Typography;

export const getPickLabel = (pick) => {
  if (!pick) return "";
  if (pick.includes("🏆")) return "Genel en iyi";
  if (pick.includes("💰")) return "En iyi değer";
  if (pick.includes("⚖")) return "Dengeli seçim";
  return "En iyi donanım";
};

// Uzun notları kısaltıp hover/dokunuşla tam gösterir (hücreyi şişirmez).
const NOTE_PREVIEW = 84;
export const formatNotes = (notes) => {
  if (!Array.isArray(notes) || notes.length === 0) return "—";
  const full = notes.map((note, idx) => <span key={idx}>• {note}<br /></span>);
  const total = notes.join(' ').length;
  if (total <= NOTE_PREVIEW) return full;
  const first = notes[0];
  const preview = first.length > NOTE_PREVIEW ? first.slice(0, NOTE_PREVIEW).trimEnd() + '…' : first + (notes.length > 1 ? ' …' : '');
  return (
    <Tooltip title={<div style={{ maxWidth: 300, lineHeight: 1.5 }}>{full}</div>} styles={{ root: { maxWidth: 340 } }}>
      <Text style={{ cursor: 'help', borderBottom: '1px dashed currentColor' }}>
        • {preview} <Text type="secondary" style={{ fontSize: 11 }}>({notes.length} not ▾)</Text>
      </Text>
    </Tooltip>
  );
};

export const findDealerForListing = (sellerTypeOrName, dealers) => {
  if (!sellerTypeOrName || sellerTypeOrName === '?' || !dealers) return null;
  const sellerLower = sellerTypeOrName.toLowerCase();
  return dealers.find(dealer =>
    dealer.matchPatterns.some(pattern => sellerLower.includes(pattern.toLowerCase()))
  ) || null;
};

export const formatAdditionalFeatures = (features) => {
  if (!Array.isArray(features)) return "—";
  
  return features.map((feat, idx) => {
    let displayStr = feat;
    // Zaten fiyat eklenmişse dokunma
    if (!feat.includes('~€')) {
      const lowerFeat = feat.toLowerCase();
      const match = FEATURE_PRICES.find(p => p.keywords.some(kw => lowerFeat.includes(kw.toLowerCase())));
      if (match) {
        const suffix = match.isAftermarket ? ' - Aftermarket' : '';
        displayStr = `${feat} (~€${match.price.toLocaleString()}${suffix})`;
      } else {
        // Tanımlanmamış donanım, her zaman fiyat (tahmini) olması istendiğinden placeholder ekle
        displayStr = `${feat} (~€?)`;
      }
    }
    
    return (
      <span key={idx}>
        • {displayStr}
        <br />
      </span>
    );
  });
};

// Ilanin yayin tarihi: listingDates.createdTime, yoksa audit'teki "İlan Yayınlandı"
// kaydi (kaynak-bagimsiz: "(mobile.de)" da "(WELLER)" da yakalanir). Bulunamazsa null.
// Tek kaynak — CarsWithRecentSubTabs (Son X gun) ve MainTabs (tarih siralamasi) kullanir.
export const getCarPublishedDate = (car) => {
  const published = car.auditHistory?.find(h => h.action?.includes('İlan Yayınlandı'));
  const raw = car.listingDates?.createdTime || published?.auditDate;
  return raw ? new Date(raw) : null;
};

// Kayittaki TUM bayi linkleri (birincil dealerListingUrl + ek dealerListingUrls).
// Merge edilen araclarda (mobile.de kanonik + bayi ikizi) UI ana linkin ALTINDA
// bunlari da gosterir — her iki ilan da ziyaret edilebilir. Tek kaynak:
// scripts/lib/existing-index.js'teki dealerUrlsOf ile ayni kural (o Node-only, bu UI).
export const dealerUrlsOf = (car) => {
  const out = [];
  if (car?.dealerListingUrl) out.push(car.dealerListingUrl);
  for (const u of car?.dealerListingUrls || []) if (u && !out.includes(u)) out.push(u);
  return out;
};

// Link etiketi: ham alan adi (or. occasions.bmw.nl, wellergruppe.de) — eslestirme
// tablosu gerekmez, hangi siteye gittigin acikca gorunur.
export const hostnameOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return String(url); }
};
