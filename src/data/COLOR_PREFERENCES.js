export const EXTERIOR_COLORS = {
  "Portimao Blue":                          { hex: "#1e5fa8", preference: "favorite" },
  "Portimao Blau":                          { hex: "#1e5fa8", preference: "favorite" },
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
  "Black":                                  { hex: "#050508", preference: "disliked" },
  "Siyah":                                  { hex: "#050508", preference: "disliked" },
  "Schwarz":                                { hex: "#050508", preference: "disliked" },
  "Black Sapphire":                         { hex: "#050508", preference: "disliked" },
  "Black Sapphire Metallic":                { hex: "#050508", preference: "disliked" },
  "Saphirschwarz":                          { hex: "#050508", preference: "disliked" },
  "Saphirschwarz Metallic":                 { hex: "#050508", preference: "disliked" },
  "Black Metallic":                         { hex: "#050508", preference: "disliked" },
  "Arctic Race Blue":                       { hex: "#1a4a8a", preference: "disliked" },
  "Arctic Race Blue metallic (individual)": { hex: "#1a4a8a", preference: "disliked" },
  "Brooklyn Grau":                          { hex: "#6b7b8a", preference: "disliked" },
  "Brooklyn Grau Metallic":                 { hex: "#6b7b8a", preference: "disliked" },
  "M Brooklyn Grau":                        { hex: "#6b7b8a", preference: "disliked" },
  "Blue":                                   { hex: "#2563eb" },
  "Mavi Metalik":                           { hex: "#2a4a7a" },
  "Blue Metallic":                          { hex: "#2a4a7a", preference: "favorite" },
  "San Remo Green":                         { hex: "#2d5a3d", preference: "disliked" },
  "Sanremo Green Metallic":                 { hex: "#2d5a3d", preference: "disliked" },
  "Sanremo Grün":                           { hex: "#2d5a3d", preference: "disliked" },
  "Tansanitblau":                           { hex: "#1a3a5c", preference: "favorite" },
  "Tansanitblau II":                        { hex: "#1a3a5c", preference: "favorite" },
  "Tansanitblau II metallic":               { hex: "#1a3a5c", preference: "favorite" },
  "Tansanit Blue":                          { hex: "#1a3a5c", preference: "favorite" },
  "Tansanit Blue II":                       { hex: "#1a3a5c", preference: "favorite" },
  "Tanzanit Blue":                          { hex: "#1a3a5c", preference: "favorite" },
  "Tanzanit Blue II":                       { hex: "#1a3a5c", preference: "favorite" },
  "Ind. Tansanit-Blau II":                  { hex: "#1a3a5c", preference: "favorite" },
  "?":                                      { hex: "#888" },
};

const EXTERIOR_ENTRIES = Object.entries(EXTERIOR_COLORS).map(([name, data]) => [name.toLowerCase(), data]);

const matchesAny = (color, predicate) => {
  if (!color) return false;
  const needle = color.toLowerCase();
  return EXTERIOR_ENTRIES.some(([name, data]) => predicate(data) && needle.includes(name));
};

export const isColorFav = (color) => matchesAny(color, data => data.preference === "favorite");
export const isColorNotFav = (color) => matchesAny(color, data => data.preference === "disliked");

// Case-insensitive lookup helper
function buildLookup(map, getValue) {
  const entries = Object.entries(map).map(([key, val]) => [key.toLowerCase(), getValue(val)]);
  return (name) => {
    if (!name) return "#888";
    const n = name.toLowerCase();
    const exact = entries.find(([k]) => k === n);
    if (exact) return exact[1];
    const partial = entries.find(([k]) => n.includes(k) || k.includes(n));
    return partial ? partial[1] : "#888";
  };
}

export const getColorHex = buildLookup(EXTERIOR_COLORS, data => data.hex);

export const INTERIOR_CODES = {
  "Deri Siyah": "#1a1a1a",
  "Siyah": "#1a1a1a",
  "Vernasca Siyah": "#1a1a1a",
  "Leder Vernasca Schwarz": "#1a1a1a",
  "Leder Schwarz (Ind. Instrumententafel)": "#1a1a1a",
  "Full leather, Black": "#1a1a1a",
  "Part leather": "#1a1a1a",
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
  "Merino Tartufo": "#8b7355",
  "Individual Merino Elfenbeinweiß": "#e6e3df",
  "Alcantara Bej": "#c8b89a",
  "Deri": "#1a1a1a",
  "Deri Diğer": "#888",
  "Deri ?": "#888",
  "?": "#888"
};

export const getInteriorHex = buildLookup(INTERIOR_CODES, v => v);
