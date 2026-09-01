---
name: bayi-tara-weller
description: WELLER Gruppe (wellergruppe.de) M440i ilanlarini tarar — arama listesi + subagent'li paralel detay okuma + `npm run import:dealer` ile src/data/listings/WELLER/ altina yazim. TRIGGER - kullanici "weller tara", "weller'i tara", "/bayi-tara-weller" yazdiginda DOGRUDAN bu skill'i calistir; ayrica "bayi tara" / "tum bayileri tara" toplu komutunun bir parcasidir.
---

# WELLER Tara

Site: **WELLER** (config: `src/data/metadata/DEALER_SITES.json` → idPrefix W, pattern `-(\d+)\/?$`, fetchStrategy chrome-tabs)

## Site Notlari (pilotta dogrulandi, 2026-08)

- **Arama listesi** server-rendered. Detay linkleri: `a[href]` icinde `pathname.startsWith('/fahrzeuge/bmw/')` VE `/-(\d+)\/?$/` eslesenler. Ayni id birden fazla linkte gecer — id bazinda dedupe et.
- Kart verisi: linkin atalarinda `€` + `km` iceren ilk container. Fiyat `([\d.]{5,9})\s*€` (SON eslesme — ustu cizili eski fiyat ilk sirada olabilir), tescil `\d{2}\/\d{4}`.
- **Sayfalama:** "Mehr Fahrzeuge anzeigen" butonu (lazy-load). Buton varsa tikla, yeni kart gelmezse dur. pageCap: 5 tur.
- **Detay sayfasi:** donanim kategori basliklariyla gruplu (Assistenzsysteme / Komfort / Exterieur / ...). `Sonderausstattung` ayrimi YOK — tum listeyi description'a al.
  - **Bazi bolumlerde collapsed `...` var — listeyi almadan ONCE bunlari TIKLAYARAK genislet.** Genisletilemezse liste EKSIKTIR: notes'a "donanim listesi eksik (collapsed)" yaz; eksik liste roota SAHTE equipmentConflicts yazdirir (C264 vakasi: 10 sahte "WELLER=no" celiskisi — canli sayfa tam listeyle hepsini curuttu). Alternatif: API `features` listesiyle sayfa listesinin BIRLESIMINI kullan — API collapsed'dan etkilenmez.
  - **Karosserie alani sayfada var; attributes.Category'ye MUTLAKA koy** — URL slug'i yalanci ("sportwagen-coupe" slug'lu Cabrio goruldu: 773891958).
  - VIN YAZMAZ (Fahrzeugnummer bayi-ici, VIN degil). `vin: null`.
  - HU / Vorbesitzer genelde yok.
  - `Differenzbesteuerung (§25a)` ibaresi varsa notes'a yaz (KDV ayristirilamaz — ihracat pazarligi etkilenir).
- Cookie banner'i icerigi bloklamiyor (pilot gozlemi).
- **API KISA YOLU (dogrulandi 2026-08-18, detay sayfasi/subagent GEREKSIZ):** site Next.js + Carfinder; detay verisi `https://api.cfdnext.com/vehicle/<id>` ile curl'den gelir (`Origin: https://wellergruppe.de` + `Referer` header'i ver; `/vehicles/...` DEGIL, tekil `/vehicle/`). Donen JSON alanlari:
  - **`categories.category` sadece Cabrio'yu KESIN ayirir** (`coupe` / `cabrio` / ...) — **Gran Coupe'yi AYIRMAZ**: GC ilanlari da `sportsCar`/`coupe` doner (2026-08-19'da 6/6 "yeni" WELLER ilani API'de sportsCar dedi, hepsi detayda Gran Coupe cikti). GC ayrimi icin **detay sayfasinin BASLIGI** tek guvenilir kaynak (`Karosserie` alani da yalanci: tum 4er'lere "Sportwagen / Coupe" yazar). Sekme basligi bile yeter: `M440i xDrive Gran Coupe ...`. — "new" cikan her WELLER ID'si icin detay acmadan ONCE bunu cek; slug govde soylemedigi icin Cabrio/GC'ler ancak burada yakalanir (696431305 vakasi: slug govdesiz, SPA detay sayfasi render olmuyor, API "cabrio" dedi).
  - **`meta.vin` VAR (altin)** — eski "VIN yazmaz" notu detay SAYFASI icindi; API'de VIN var, MUTLAKA al.
  - Digerleri: `purchaseOptions.price.value` + `vatReportable` (false = §25a marj, notes'a), `condition` (registrationDate/mileage/preOwner), `appearance` (renk/doseme), `environmental.wltp.co2emissions`, `features` (Ingilizce key listesi), `locations[0]` (sube adi/adres), `data` (kW/kapi/vites).
  - Donanim listesi `features`'ta Ingilizce key olarak gelir; description icin yine de detay sayfasi gerekebilir — ama govde/VIN/fiyat/durum eleme ve dedup icin API yeterli.
- **Bilinen GC/Cabrio ID'leri (detay ACMA, 2026-08-20'de yeniden dogrulandi):**
  - Gran Coupe: `753729361`, `633623181`, `410223424`, `189665308`, `186946331`, `1032918677` (2026-08-19'da 6/6 detaydan); `591394983` API'de `limousine` (GC); `15059066` (2026-08-24 detay basligindan: API `sportsCar` dedi, sayfa basligi "M440i xDrive Gran Coupe M SPORT PRO" — slug `sportwagen-coupe` yine yalanci).
  - Cabrio: `552293618`, `696431305` — API `categories.category === "cabrio"` (2026-08-20 curl ile teyit; slug zaten `cabrio-roadster`), `773891958` (repoda W2); `369247732`, `81401626`, `76950599` (2026-08-24 API `cabrio`).
  - Bunlar repoya alinmadigi icin **her taramada tekrar `new` gorunur** — listede gorursen detay/subagent ACMA, GC/Cabrio diye raporla. 2026-08-20 turunda 11 karttan 9'u bu listeydi; site fazi saniyeler surdu.
- **"new" cikan ID'ler icin ucuz kapi:** listedeki her `new` ID'yi tek tek curl ile `api.cfdnext.com/vehicle/<id>` sorgula (`categories.category` + `meta.vin`). Cabrio KESIN elenir; `coupe`/`sportsCar` donenler icin GC ayrimi hala detay BASLIGINDAN yapilir. Bu kapi, detay sayfasi acmadan cogu ilani eledigi icin subagent maliyetini sifirlar.
- **SPA detay fallback tuzagi:** bazi ilanlarin `/fahrzeuge/bmw/<slug>-<id>/` sayfasi render OLMAZ (generic arama listesine duser, "3.478 Fahrzeuge"). Bunu "ilan kayip" sanma — once API'yi dene; API 200 donuyorsa ilan yayinda demektir.

- **API `features` camelCase ANAHTAR doner — import kaydina OLDUGU GIBI koyma (C1101 vakasi, 2026-08-26).**
  `features: ["rainSensor","laneAssistSystem",...]` gibi anahtarlar EQUIPMENT_RULES'un insan-okunur
  Ingilizce `features` listesiyle (`"Light sensor"`, `"Electric seat adjustment"`) HIC eslesmez; eslesme
  yalniz Almanca `description`'a kalir ve WELLER'in yazim varyantlari kalip listesinde yoksa merge
  SAHTE `equipmentConflicts` ("mobile.de=yes / WELLER=no") yazar. C1101'de 4 sahte celiski cikti;
  ikisi kalip eksikligiydi (`Fahrer-/Beifahrersitz elektrisch` + `Memoryfunktion Fahrersitz` -> S459A,
  `Lichtsensor` -> S524A; EQUIPMENT_RULES'a eklendi + regresyon testi `equipment-rules.test.js`).
  Kural: donanim kanitini `description.grouped` Almanca metninden ver; camelCase feature anahtarlarini
  kanit sayma. Cok sayida celiski gorursen once kalip eksikligini/liste eksikligini dogrula.
- **WELLER DMS donanim adlarini KISALTIR — kisaltma da kanittir (C264 vakasi, 2026-08-28).**
  WELLER'in mobile.de metni koltugu `Sitze Teilleder schw./Kon. bl.` diye yaziyor; icinde "Alcantara"
  gecmedigi icin KGNL yanlislikla `no` oldu. Ayni araci BMW.de resmi kaydi
  `Polster: Alcantara-/Sensatec-Kombination Schwarz/Kontraststeppung Blau SW (FKGNL)` diye yaziyor ve
  fotograflarda koltuk/arka koltuk Alcantara panelleri acikca goruluyor. `schw./Kon. bl.` =
  "Schwarz/Kontraststeppung blau" → G22 M Sport'un Alcantara/Sensatec kombinasyonu (FKGNL).
  Kalip `EQUIPMENT_RULES.json` KGNL description'ina eklendi + regresyon testi
  (`equipment-rules.test.js`). Kural: WELLER metninde kisaltilmis donanim satiri gorursen tam adini
  BMW.de / bayi sayfasindan cozup kalip listesine ekle; ayrica ayni kisaltmayi tasiyan diger kayitlari
  (`grep "Kon. bl." dump/*.json`) da tara — C272 ayni desendeydi.
- **Ilan metninde HIC gecmeyen donanim icin fotograf kanittir.** C264'te dachhimmel satiri WELLER
  listesinde yok ama tavan fotografinda antrasit dachhimmel net goruluyor → S775A `yes`,
  `overrideFeatures` ile kalicilastirildi (rematch ezmesin). Tersine "yok" kararlarinin cogu da
  fotograftan dogrulanabilir: konsolda `ADAPTIVE` modu yoksa S2VFA yok, koltuk yan panelinde lordoz
  rocker'i yoksa S488A yok, hoparlor izgarasinda `harman/kardon` logosu yoksa S688A yok.
- **Ayni arac mobile.de'de once cikabilir.** C1101 (mobile.de 41885931759584) WELLER'da 6 gun sonra
  `592710382` olarak yayina girdi; kayit VIN'siz oldugu icin `filter-listings.js` "new" dedi ama
  `import-dealer.js` parmak izinden (tescil+km+fiyat+satici) ikizi buldu ve KOK kayda merge etti —
  kazanim: VIN (`WBA61AT090CN76352`), `dealerListingUrl`, CO2 171 g/km. Yani WELLER'da "gercek yeni"
  cikan bir ID once mobile.de kaydinin ikizi olabilir; import'u dry-run ile calistirip `merged`
  ciktisina bak.

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=WELLER icin uygula (fetchStrategy: chrome-tabs, subagent'li paralel detay).
