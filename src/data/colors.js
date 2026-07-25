// Renk çözümleme — SAF DÜZ LOOKUP, normalize/fuzzy YOK.
// Veri tek kaynak: constants/COLORS.json (her listing string açık key → {hex, preference?}).
// Bir string katalogda yoksa null döner (UI "?"); yeni renk gelince JSON'a eklenir.
import catalog from './constants/COLORS.json';

const EXT = catalog.exterior;
const INT = catalog.interior;

// Tam eşleşme (case-sensitive) — hiçbir dönüşüm uygulanmaz.
export const colorMeta = (name) => (name != null && EXT[name]) || null;
export const interiorMeta = (name) => (name != null && INT[name]) || null;

export const getColorHex = (name) => colorMeta(name)?.hex ?? null;
export const getInteriorHex = (name) => interiorMeta(name)?.hex ?? null;
export const isColorFav = (name) => colorMeta(name)?.preference === 'favorite';
export const isColorNotFav = (name) => colorMeta(name)?.preference === 'disliked';
export const isInteriorFav = (name) => interiorMeta(name)?.preference === 'favorite';
export const isInteriorNotFav = (name) => interiorMeta(name)?.preference === 'disliked';

// Bir aracın dış VEYA iç rengi sevilmeyen mi (beyaz dış / kırmızı-kahve koltuk).
export const hasDislikedColor = (car) =>
  colorMeta(car.exteriorColorName)?.preference === 'disliked' ||
  interiorMeta(car.interiorColorName)?.preference === 'disliked';

// Legend/liste için: bir kind+preference'ın temsili renk adları (hex-benzersiz).
// Tek kaynak COLORS.json → gösterim ile veri asla drift etmez.
export const colorNamesByPreference = (kind, preference) => {
  const map = kind === 'interior' ? INT : EXT;
  const seen = new Set(), out = [];
  for (const [name, v] of Object.entries(map)) {
    if (v.preference === preference && v.hex && !seen.has(v.hex)) { seen.add(v.hex); out.push(name); }
  }
  return out;
};
