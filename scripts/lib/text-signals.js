// Ilan metninden sinyal cikarma — kelime tablolari KODDA DEGIL, config'te:
// src/data/metadata/TEXT_SIGNALS.json (tek kaynak; drivetrain.js, route-listing.js,
// import-dealer.js hepsi buradan okur). Yeni bir dil/yazim varyanti cikinca kod
// degismez, JSON'a kelime eklenir — skill dosyasina kalip YAZILMAZ.
//
// UI de bu zinciri import ediyor (CarTable → drivetrain.js), o yuzden fs/path
// KULLANILAMAZ; import attribute hem Node 22+ hem Vite'ta calisir.
import TEXT_SIGNALS from '../../src/data/metadata/TEXT_SIGNALS.json' with { type: 'json' };

export { TEXT_SIGNALS };

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Kelimedeki BOSLUK = metinde opsiyonel bosluk/tire ("x drive" → xDrive / x-drive / x drive).
export const wordToRegex = (word) =>
  new RegExp(String(word).trim().split(/\s+/).map(escapeRe).join('[-\\s]?'), 'i');

// Listedeki ilk eslesen kelimenin METINDEKI HALINI dondurur (gerekce string'inde
// kullanilir: "ilan metninde \"X-Drive\" geçiyor"), eslesme yoksa null.
export const matchAnyWord = (text, words = []) => {
  const haystack = String(text ?? '');
  for (const word of words) {
    const hit = haystack.match(wordToRegex(word));
    if (hit) return hit[0];
  }
  return null;
};

// Marj araci (KDV indirilemez) beyani — NL "BTW verrekenbaar: Nee", DE "differenzbesteuert".
export const detectMarginVat = (text) => matchAnyWord(text, TEXT_SIGNALS.vat.marginWords);
export const MARGIN_VAT_NOTE = TEXT_SIGNALS.vat.marginNote;
