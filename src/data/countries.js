// Ülke çözümleme — SAF DÜZ LOOKUP, normalize/fuzzy YOK.
// Veri tek kaynak: metadata/COUNTRY_FLAGS.json (kod → bayrak emoji).
// listingLocation'ı parse-car-json.js her zaman "<bayrak> <ham adres>" olarak kurar,
// yani baştaki bayrak ülkenin TEK güvenilir sinyali (adres metni serbest formatlı).
import COUNTRY_FLAGS from './metadata/COUNTRY_FLAGS.json';

// Ters tablo: bayrak emoji → ülke kodu. 'fallback' (🇪🇺) bir ülke değil, dışarıda kalır.
const CODE_BY_FLAG = Object.fromEntries(
  Object.entries(COUNTRY_FLAGS)
    .filter(([code]) => code !== 'fallback')
    .map(([code, flag]) => [flag, code])
);

// Bayrak emoji 2 code point (regional indicator çifti) → ilk 2 code point'i al, düz lookup.
// Tanınmayan/eksik bayrak → null (UI/hesap "bilinmiyor" gibi davranır).
export const countryCodeOf = (car) => {
  const location = car?.listingLocation;
  if (!location) return null;
  return CODE_BY_FLAG[[...location].slice(0, 2).join('')] ?? null;
};
