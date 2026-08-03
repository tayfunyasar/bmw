// Kayitli bir ilanin listingLocation'indan ulke kodu cozer (Node script tarafi).
//
// Neden ayri modul: src/data/countries.js ayni isi UI tarafinda yapar ama JSON'u
// `import ... from './x.json'` ile alir — bu yalnizca Vite altinda calisir, Node
// script'lerinden import edilemez. Mantik ayni, kaynak veri de ayni dosya.
//
// listingLocation'i parse-car-json.js her zaman "<bayrak> <ham adres>" olarak kurar,
// yani bastaki bayrak ulkenin tek guvenilir sinyali (adres metni serbest formatli).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COUNTRY_FLAGS = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../src/data/metadata/COUNTRY_FLAGS.json'), 'utf8')
);

// Ters tablo: bayrak emoji → ulke kodu. 'fallback' (🇪🇺) bir ulke degil, disarida kalir.
const CODE_BY_FLAG = Object.fromEntries(
  Object.entries(COUNTRY_FLAGS)
    .filter(([code]) => code !== 'fallback')
    .map(([code, flag]) => [flag, code])
);

// Bayrak emoji 2 code point (regional indicator cifti) → ilk 2 code point, duz lookup.
export const countryCodeFromLocation = (listingLocation) => {
  if (!listingLocation) return null;
  return CODE_BY_FLAG[[...listingLocation].slice(0, 2).join('')] ?? null;
};
