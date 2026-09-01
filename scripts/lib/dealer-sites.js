// Bayi sitesi config'ini cozumler — tek kaynak: src/data/metadata/DEALER_SITES.json.
// Site skill'leri ve import-dealer.js buradan okur; site listesi/desenleri koda yazilmaz.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, '../../src/data/metadata/DEALER_SITES.json');

const config = () => JSON.parse(fs.readFileSync(configPath, 'utf8'));

export function loadDealerSites() {
  return config().sites;
}

export function siteConfig(name) {
  const site = loadDealerSites().find(s => s.site === name);
  if (!site) throw new Error(`Bilinmeyen bayi sitesi: "${name}" — src/data/metadata/DEALER_SITES.json'a ekle`);
  return site;
}

// Site-ici tekil anahtar: "WELLER:12345". detailUrlIdPattern URL'den ID cikaramazsa
// (veya tanimsizsa) anahtar URL'nin kendisidir (kirpilmis) — yine deterministik.
export function dealerKeyFor(site, url) {
  if (!url) return null;
  const cfg = typeof site === 'string' ? siteConfig(site) : site;
  if (cfg.detailUrlIdPattern) {
    const m = String(url).match(new RegExp(cfg.detailUrlIdPattern));
    if (m && m[1]) return `${cfg.site}:${m[1]}`;
  }
  return `${cfg.site}:${String(url).trim().replace(/\/+$/, '')}`;
}

// Iki satici adi ayni bayiye mi isaret ediyor? Jenerik sirket kelimeleri atilir,
// anlamli kelime kesisimi aranir. "WELLER Premium GmbH" ~ "WELLER Hildesheim" -> true.
// Fuzzy-ikiz + satici eslesmesi = ayni fiziksel arac (tek kayda birlestirilir).
// Kelime listesi config'te (DEALER_SITES.json → genericSellerWords).
const GENERIC_SELLER_WORDS = new Set(config().genericSellerWords);
export function sellerMatches(a, b) {
  const words = (x) => new Set(String(x || '').toLowerCase().replace(/[^a-zäöüß ]/g, ' ').split(/\s+/)
    .filter(w => w.length >= 3 && !GENERIC_SELLER_WORDS.has(w)));
  const wa = words(a), wb = words(b);
  for (const w of wa) if (wb.has(w)) return true;
  return false;
}

export function detailUrlFromId(site, id) {
  const cfg = typeof site === 'string' ? siteConfig(site) : site;
  if (!cfg.detailUrlTemplate) return null;
  return cfg.detailUrlTemplate.replace('{id}', id);
}
