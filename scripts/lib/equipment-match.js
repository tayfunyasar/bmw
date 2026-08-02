// Bir aracin metin/feature/props verisini EQUIPMENT_RULES kurallariyla esler
// ve her kural kodu icin "yes" / "no" / "unknown" durumu uretir.
//
// Tek kaynak: hem parse-car-json.js hem de equipment-rules.test.js bu modulu
// kullanir — eslestirme mantigi asla baska bir yere kopyalanmaz.
//
// Eslestirme oncelik sirasi (yuksekten dusuge):
//   0. fabrika opsiyon kodu         -> "yes"  (ör. "(05AZ)"; en yetkili — bkz. optionCodeOf)
//   1. description pozitif eslesme  -> "yes"  (bayinin kendi metni)
//   2. negativeDescription eslesme  -> "no"
//   3. features / props eslesme     -> "yes"  (checkbox — yalnizca pozitif sinyal)
//   4. hicbiri                      -> fallback (asagi bak)
// Ardindan impliedBy: ust ozellik description'da geciyorsa alt ozellik "yes".
//
// Fallback (hicbir kaynakta bulunamayan donanim):
//   - description "bilgilendirici" ise (>= MIN_INFORMATIVE_DESC_MATCHES donanim
//     prose'dan belirlendiyse) -> prose'da yoksa donanim gercekten yoktur ->
//     rule.defaultStatus ?? "no". Kurala ozel "unknown" defaultStatus'ler
//     (ambigü/pakete gomulu kalemler) korunur.
//   - description bilgilendirici degilse (bos/pazarlama metni) absence guvenilmez
//     -> "unknown" (guvenlik freni). checkbox'ta isaretlenmemis olmak tek basina
//     "yok" demek degildir; bu yuzden karar description'a dayanir.
//
// Tum metin karsilastirmalari kucuk harfe cevrilir ve tire/uzun-tire (- –)
// bosluga normalize edilir; boylece "Driving-Assistant" ~ "Driving Assistant".

const DASH_RE = /[-–]/g;

// Bayiler donanimi cogu zaman BMW fabrika opsiyon koduyla birlikte yazar:
//   "Laserscheinwerfer (05AZ)", "Soundsystem (0688)", "Lendenstutzen (0488)"
// Bizim kod semamiz (S5AZA, S688A, S488A) bu koddan TURETILEBILIR: bastaki "S" ve
// sondaki "A" atilir, kalan 4 haneye sifirla doldurulur. Yani ayri bir eslesme
// tablosu GEREKMEZ — kural kodunun kendisi tek kaynak.
// S5DN_360 / KGNL gibi sentetik kodlar bu kaliba uymaz → null (opsiyon kodu yok).
const OPTION_CODE_RE = /^S([0-9][0-9A-Z]{2})A$/;
export const optionCodeOf = (ruleCode) => {
  const match = OPTION_CODE_RE.exec(ruleCode || '');
  return match ? match[1].padStart(4, '0').toLowerCase() : null;
};

// Token'i metinde ARAR ama alfanumerik bir dizinin ICINDE saymaz: "0610" telefon
// numarasindaki "06104"e eslesmemeli. Sinirlari alfanumerik olmayan karakter olmali.
const ALPHANUMERIC = /[0-9a-z]/;
const containsToken = (haystack, token) => {
  for (let from = 0; ; from++) {
    const at = haystack.indexOf(token, from);
    if (at < 0) return false;
    const before = at > 0 ? haystack[at - 1] : '';
    const after = haystack[at + token.length] ?? '';
    if (!ALPHANUMERIC.test(before) && !ALPHANUMERIC.test(after)) return true;
    from = at;
  }
};

// Bir aciklamayi "bilgilendirici" saymak icin gereken minimum donanim eslesmesi.
// Gercek bir Alman donanim listesi (Sonderausstattung / build-sheet) cok sayida
// keyword icerir; salt pazarlama metni ~0 icerir. Bu esigin altinda "prose'da
// yok = yok" cikarimi yapilmaz. Tunable — dusurmek daha agresif "no" uretir.
const MIN_INFORMATIVE_DESC_MATCHES = 3;

// mobile.de checkbox listesi "kapsamli" sayilacak minimum kalem sayisi. Gercek
// ilanlar 37-75 kalem tasir; bu esigin uzerindeki bir listede, checkbox ile
// tespit edilebilir bir donanim isaretli DEGILSE gercekten yoktur ("no").
// Bozuk/cok kisa listeler (< esik) korunur → eski fallback (unknown) uygulanir.
const RICH_CHECKBOX_MIN = 15;

// Kucuk harf + tire/uzun-tireyi bosluga cevirerek metni normalize eder.
export function normalizeText(text = '') {
  return String(text).toLowerCase().replace(DASH_RE, ' ');
}

// Tek bir aracin donanim durumlarini hesaplar.
//   car: { description?: string, features?: string[], props?: object }
//   equipmentRules: EQUIPMENT_RULES.json dizisi
//   donus: { [rule.code]: "yes" | "no" | "unknown" }
export function matchEquipmentFeatures(car = {}, equipmentRules = []) {
  const description = car.description || '';
  const features = car.features || [];
  const props = car.props || {};

  const descNormalized = normalizeText(description);
  const descMatches = (keyword) => descNormalized.includes(normalizeText(keyword));

  const equipmentFeatures = {};
  const pendingFallback = []; // hicbir kaynakta karar verilemeyen kurallar
  let descInfoHits = 0;       // description'dan (pozitif/negatif) belirlenen kural sayisi

  for (const rule of equipmentRules) {
    // 0. Fabrika opsiyon kodu ("(05AZ)") — bayinin build-sheet'inden birebir kod.
    //    Serbest metin cevirisine BAGLI DEGIL, o yuzden en yetkili sinyal: hem
    //    pozitif hem negatif description eslesmelerini ezer.
    const optionCode = optionCodeOf(rule.code);
    if (optionCode && containsToken(descNormalized, optionCode)) {
      equipmentFeatures[rule.code] = 'yes';
      descInfoHits++;
      continue;
    }

    // 1. Pozitif description eslesmesi (bayinin kendi metni).
    let matchDescription = false;
    if (rule.matchType === 'ALL_DESCRIPTION' && rule.description?.length > 0) {
      matchDescription = rule.description.every(descMatches);
    } else if (rule.description?.length > 0) {
      matchDescription = rule.description.some(descMatches);
    }
    if (matchDescription) {
      equipmentFeatures[rule.code] = 'yes';
      descInfoHits++;
      continue;
    }

    // 2. Negatif description (yalnizca pozitif eslesme yokken anlamli).
    if (rule.negativeDescription?.length > 0 && rule.negativeDescription.some(descMatches)) {
      equipmentFeatures[rule.code] = 'no';
      descInfoHits++;
      continue;
    }

    // 3. features dizisi ve props (Apify anahtar-deger verisi — dusuk oncelik).
    const matchFeatures = rule.features?.some(f => features.includes(f));
    const matchProps = rule.props
      ? Object.entries(rule.props).some(([propKey, propValues]) =>
          propValues.some(val => (props[propKey] || '').includes(val)))
      : false;
    if (matchFeatures || matchProps) {
      equipmentFeatures[rule.code] = 'yes';
      continue;
    }

    // 3b. Checkbox otoritesi: kural checkbox/props ile tespit edilebilir VE aracin
    //     checkbox listesi kapsamli ise, eslesme yoklugu = gercekten yok. mobile.de
    //     checkbox'i kapsamli bir listedir; icinde yoksa buyuk ihtimalle yoktur.
    const checkboxMappable = (rule.features?.length > 0) || (rule.props && Object.keys(rule.props).length > 0);
    if (checkboxMappable && features.length >= RICH_CHECKBOX_MIN) {
      equipmentFeatures[rule.code] = 'no';
      continue;
    }

    // 4. Hicbir sinyal yok (sadece-aciklama kurali veya zayif checkbox) —
    //    fallback'i description guveni belli olunca cozeriz.
    pendingFallback.push(rule);
  }

  // Fallback cozumu: description yeterince bilgilendirici mi?
  const descriptionInformative = descInfoHits >= MIN_INFORMATIVE_DESC_MATCHES;
  for (const rule of pendingFallback) {
    equipmentFeatures[rule.code] = descriptionInformative
      ? (rule.defaultStatus ?? 'no')
      : 'unknown';
  }

  // impliedBy: ust ozellik description'da geciyorsa alt ozellik "yes" olur.
  for (const rule of equipmentRules) {
    if (rule.impliedBy && equipmentFeatures[rule.code] !== 'yes') {
      if (rule.impliedBy.some(p => descNormalized.includes(normalizeText(p)))) {
        equipmentFeatures[rule.code] = 'yes';
      }
    }
  }

  return equipmentFeatures;
}
