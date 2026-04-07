export const favColors = ["Tansanit Blue","Tansanit Blue II","Tanzanit Blue","Tanzanit Blue II","Tansanitblau","Tansanitblau II","Blue Metallic"];
export const notFavColors = ["Arctic Race Blue","San Remo Green","M Brooklyn Grau","Brooklyn Grau"];
export const isColorFav = (color) => favColors.some(f => color?.toLowerCase().includes(f.toLowerCase()));
export const isColorNotFav = (color) => notFavColors.some(f => color?.toLowerCase().includes(f.toLowerCase()));

// Case-insensitive lookup helper
function buildLookup(map) {
  const entries = Object.entries(map).map(([key, val]) => [key.toLowerCase(), val]);
  return (name) => {
    if (!name) return "#888";
    const n = name.toLowerCase();
    // Exact match first
    const exact = entries.find(([k]) => k === n);
    if (exact) return exact[1];
    // Then check if input contains a key or key contains input
    const partial = entries.find(([k]) => n.includes(k) || k.includes(n));
    return partial ? partial[1] : "#888";
  };
}

export const COLOR_CODES = {
  "Portimao Blue": "#1e5fa8",
  "Portimao Blau": "#1e5fa8",
  "Alpine White": "#f0f0f0",
  "Beyaz": "#f0f0f0",
  "Mineralweiss": "#f0f0f0",
  "Mineralweiss Metallic": "#f0f0f0",
  "Mineral White Metallic": "#f0f0f0",
  "Dravitgrau": "#7a7d7f",
  "Dravitgrau Metallic": "#7a7d7f",
  "BMW Ind. Dravitgrau": "#7a7d7f",
  "Grey Metallic": "#7a7d7f",
  "Black Sapphire": "#050508",
  "Black Sapphire Metallic": "#050508",
  "Saphirschwarz": "#050508",
  "Saphirschwarz Metallic": "#050508",
  "Black Metallic": "#050508",
  "Arctic Race Blue": "#1a4a8a",
  "Arctic Race Blue metallic (individual)": "#1a4a8a",
  "Brooklyn Grau": "#6b7b8a",
  "Brooklyn Grau Metallic": "#6b7b8a",
  "M Brooklyn Grau": "#6b7b8a",
  "Blue": "#2563eb",
  "Mavi Metalik": "#2a4a7a",
  "Blue Metallic": "#2a4a7a",
  "San Remo Green": "#2d5a3d",
  "Sanremo Green Metallic": "#2d5a3d",
  "Sanremo Grün": "#2d5a3d",
  "Tansanitblau II": "#1a3a5c",
  "Tansanitblau II metallic": "#1a3a5c",
  "Tansanit Blue II": "#1a3a5c",
  "Ind. Tansanit-Blau II": "#1a3a5c",
  "?": "#888"
};

export const getColorHex = buildLookup(COLOR_CODES);

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

export const getInteriorHex = buildLookup(INTERIOR_CODES);
