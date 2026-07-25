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
