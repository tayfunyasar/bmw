export const EXTERIOR_COLORS = {
  "Portimao Blue":                          { hex: "#1e5fa8", preference: "favorite" },
  "Portimao Blau":                          { hex: "#1e5fa8", preference: "favorite" },
  "White":                                  { hex: "#f0f0f0", preference: "disliked" },
  "Weiss":                                  { hex: "#f0f0f0", preference: "disliked" },
  "Alpine White":                           { hex: "#f0f0f0", preference: "disliked" },
  "Alpinweiß":                              { hex: "#f0f0f0", preference: "disliked" },
  "Alpinweiss":                             { hex: "#f0f0f0", preference: "disliked" },
  "Beyaz":                                  { hex: "#f0f0f0", preference: "disliked" },
  "Mineralweiss":                           { hex: "#f0f0f0", preference: "disliked" },
  "Mineralweiss Metallic":                  { hex: "#f0f0f0", preference: "disliked" },
  "Mineral White Metallic":                 { hex: "#f0f0f0", preference: "disliked" },
  "Dravitgrau":                             { hex: "#7a7d7f", preference: "favorite" },
  "Dravitgrau Metallic":                    { hex: "#7a7d7f", preference: "favorite" },
  "BMW Ind. Dravitgrau":                    { hex: "#7a7d7f", preference: "favorite" },
  "Sophistograu":                           { hex: "#5e5e5e", preference: "favorite" },
  "Sophistograu-metallic":                  { hex: "#5e5e5e", preference: "favorite" },
  "Sophisto Grey":                          { hex: "#5e5e5e", preference: "favorite" },
  "Grey Metallic":                          { hex: "#7a7d7f" },
  "Black":                                  { hex: "#050508" },
  "Siyah":                                  { hex: "#050508" },
  "Schwarz":                                { hex: "#050508" },
  "Black Sapphire":                         { hex: "#050508" },
  "Black Sapphire Metallic":                { hex: "#050508" },
  "Saphirschwarz":                          { hex: "#050508" },
  "Saphirschwarz Metallic":                 { hex: "#050508" },
  "Black Metallic":                         { hex: "#050508" },
  "Arctic Race Blue":                       { hex: "#1a4a8a" },
  "Arctic Race Blue metallic (individual)": { hex: "#1a4a8a" },
  "Brooklyn Grau":                          { hex: "#6b7b8a", preference: "disliked" },
  "Brooklyn Grau Metallic":                 { hex: "#6b7b8a", preference: "disliked" },
  "M Brooklyn Grau":                        { hex: "#6b7b8a", preference: "disliked" },
  "Blue":                                   { hex: "#2563eb", preference: "favorite" },
  "Mavi Metalik":                           { hex: "#2a4a7a", preference: "favorite"  },
  "Blue Metallic":                          { hex: "#2a4a7a", preference: "favorite" },
  "San Remo Green":                         { hex: "#2d5a3d", preference: "disliked" },
  "Sanremo Green Metallic":                 { hex: "#2d5a3d", preference: "disliked" },
  "Sanremo Grün":                           { hex: "#2d5a3d", preference: "disliked" },
  // Stem keys — match every variant (Tansanitblau/-blau II/-metallic, English
  // Tanzanit spelling, and truncated dumps like "BMW Individual Tansanitbl").
  "Tansanit":                               { hex: "#1a3a5c", preference: "favorite" },
  "Tanzanit":                               { hex: "#1a3a5c", preference: "favorite" },
  "Fire Red":                               { hex: "#c8102e" },
  "Fire Red Metallic":                      { hex: "#c8102e" },
  "Feuerrot":                               { hex: "#c8102e" },
  "Feuerrot Metallic":                      { hex: "#c8102e" },
  "Melbourne Red":                          { hex: "#7a1a22" },
  "Melbourne Red Metallic":                 { hex: "#7a1a22" },
  "Toronto Red":                            { hex: "#b5121c" },
  "Toronto Red Metallic":                   { hex: "#b5121c" },
  "Red":                                    { hex: "#c8102e" },
  "Kırmızı":                                { hex: "#c8102e" },
};

// Normalize for matching: lowercase + German ß → ss, so "Mineralweiß" matches "Mineralweiss".
const norm = (s) => s.toLowerCase().replace(/ß/g, "ss");

const toEntries = (map) => Object.entries(map).map(([name, data]) => [norm(name), data]);
const EXTERIOR_ENTRIES = toEntries(EXTERIOR_COLORS);

const matchesAny = (entries, color, predicate) => {
  if (!color) return false;
  const needle = norm(color);
  return entries.some(([name, data]) => predicate(data) && needle.includes(name));
};

export const isColorFav = (color) => matchesAny(EXTERIOR_ENTRIES, color, data => data.preference === "favorite");
export const isColorNotFav = (color) => matchesAny(EXTERIOR_ENTRIES, color, data => data.preference === "disliked");

// Case-insensitive lookup helper. Returns null when the color isn't known,
// so the UI can render a "?" icon instead of a misleading gray swatch.
function buildLookup(map, getValue) {
  const entries = Object.entries(map).map(([key, val]) => [norm(key), getValue(val)]);
  return (name) => {
    if (!name) return null;
    const n = norm(name);
    const exact = entries.find(([k]) => k === n);
    if (exact) return exact[1];
    // Prefer the longest (most specific) matching key so e.g. "Tansanit Blue"
    // resolves to Tansanit and not the generic "Blue".
    const partial = entries
      .filter(([k]) => n.includes(k) || k.includes(n))
      .sort((a, b) => b[0].length - a[0].length)[0];
    return partial ? partial[1] : null;
  };
}

export const getColorHex = buildLookup(EXTERIOR_COLORS, data => data.hex);

export const INTERIOR_CODES = {
  // Stem key — her Alcantara varyantının (Siyah/Black/Sensatec/dikiş…) hex'ini verir.
  // BİLİNÇLİ OLARAK "favorite" DEĞİL: Alcantara koltuk artık KGNL donanım kuralıyla
  // (900€ ×2) puanlanıyor; burada da favori saymak aynı özelliği ÇİFT sayardı.
  // ⭐ rozeti tabloda KGNL === "yes" üzerinden gösterilir (bkz. InteriorDisplay).
  "Alcantara": "#1a1a2e",
  "Deri Siyah": "#1a1a1a",
  "Other, Black": "#1a1a1a",
  "Siyah": "#1a1a1a",
  "Vernasca Siyah": "#1a1a1a",
  "Leder Vernasca Schwarz": "#1a1a1a",
  "Leder Schwarz (Ind. Instrumententafel)": "#1a1a1a",
  "Full leather, Black": "#1a1a1a",
  "Part leather": "#1a1a1a",
  "Cloth, Black": "#1a1a1a",
  "Cloth Black": "#1a1a1a",
  "Stoff Schwarz": "#1a1a1a",
  "Stoff, Schwarz": "#1a1a1a",
  "Kumaş Siyah": "#1a1a1a",
  "Kumaş, Siyah": "#1a1a1a",
  "Alcantara-Leder": "#1a1a2e",
  "Alcantara Siyah": "#1a1a2e",
  "Alcantara Black": "#1a1a2e",
  "Alcantara, Siyah": "#1a1a2e",
  "Alcantara, Black": "#1a1a2e",
  "Alcantara / Sensatec Siyah": "#1a1a2e",
  "Alcantara/Sensatec Siyah": "#1a1a2e",
  "Alcantara/Carbon Siyah": "#1a1a1a",
  "Merino Siyah (Individual)": "#1a1a1a",
  "Alcantara Siyah (mavi dikiş)": "#1a1a2e",
  "Alcantara Siyah (Blau stitch)": "#1a1a2e",
  "Vernasca Siyah (mavi dikiş)": "#1a1a2e",
  "Vernasca Siyah (gri dikiş)": "#1a1a1a",
  "Leder Vernasca Schwarz/Blau": "#1a1a2e",
  "Deri Kahve (Vernasca)": "#604020",
  "Full leather, Brown": "#604020",
  "Full leather, Red": { hex: "#8b1a2a", preference: "disliked" },
  "Merino Tartufo": "#8b7355",
  "Individual Merino Elfenbeinweiß": "#e6e3df",
  "Alcantara Bej": "#c8b89a",
  "Deri": "#1a1a1a",
  // Unknown interior placeholders map to nothing → UI renders a "?" icon.
};

// Interior values are either a plain hex string or { hex, preference } like EXTERIOR_COLORS.
export const getInteriorHex = buildLookup(INTERIOR_CODES, v => (typeof v === "string" ? v : v.hex));

// Preference matching uses stem semantics (needle contains key) like the exterior
// helpers, so "Alcantara Siyah (mavi dikiş)" inherits the "Alcantara" stem's preference.
const INTERIOR_ENTRIES = toEntries(INTERIOR_CODES);
const interiorPref = (v) => (typeof v === "string" ? null : v.preference ?? null);
export const isInteriorFav = (name) => matchesAny(INTERIOR_ENTRIES, name, v => interiorPref(v) === "favorite");
export const isInteriorNotFav = (name) => matchesAny(INTERIOR_ENTRIES, name, v => interiorPref(v) === "disliked");
