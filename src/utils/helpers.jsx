import React from 'react';
import FEATURE_PRICES from '../data/metadata/FEATURE_PRICES.json';

export const getPickLabel = (pick) => {
  if (!pick) return "";
  if (pick.includes("🏆")) return "Genel en iyi";
  if (pick.includes("💰")) return "En iyi değer";
  if (pick.includes("⚖")) return "Dengeli seçim";
  return "En iyi donanım";
};

export const formatNotes = (notes) => {
  if (!Array.isArray(notes)) return "—";
  return notes.map((note, idx) => (
    <span key={idx}>
      • {note}
      <br />
    </span>
  ));
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
