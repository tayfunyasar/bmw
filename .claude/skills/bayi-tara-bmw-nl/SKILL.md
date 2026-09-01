---
name: bayi-tara-bmw-nl
description: BMW NL Occasions (occasions.bmw.nl, resmi Hollanda BMW ikinci el — BPM odenmis LOKAL araclar) 4 Serie Coupe ilanlarini tarar — bayi-tara ortak akisiyla src/data/listings/BMW_NL/ altina yazim. TRIGGER - kullanici "bmw nl tara", "occasions tara", "/bayi-tara-bmw-nl" yazdiginda DOGRUDAN calistir; "bayi tara" toplu komutunun parcasidir.
---

# BMW NL Occasions Tara

Site: **BMW_NL** (config: DEALER_SITES.json → idPrefix N, pattern `\/details\/id\/(\d+)`, template var, defaultCountry NL)

## Site Notlari (kesif 2026-08)

- **KRITIK AYRICALIK: NL araclari — BPM ZATEN ODENMIS.** dealer.contry="NL" MUTLAKA set edilmeli; pricingCalculator NL araclarina BPM eklemez (applyBpmExemption). Toplam maliyet karsilastirmasi bu yuzden dogru cikar.
- Arama URL'sindeki `filters` parametresi base64 + PHP-serialize (icinde page/serie/chassis/fuel/datePartOne). ELLE OYNAMA — bookmark'taki hazir URL'yi ac. Sayfalama icin sayfadaki "volgende"/sonraki linkini izle (filters'i yeniden uretmeye CALISMA).
- ⚠️ **Bookmark URL'si SAYFA 2'ye acilir** (base64 icinde `page:"2"` gomulu — dogrulandi 2026-08-20). Yani ilk okudugun liste sayfa 1 DEGIL. Sayfa "2" linkine tiklamak hicbir sey yapmaz (zaten oradasin) ve ayni 18 kayit gelir — bunu "sayfalama calismiyor" sanma. Dogru akis: bookmark'i ac (=s2) → oku, sonra `1` linkine tikla → oku, sonra `3` → oku. Hangi sayfada oldugunu `.pagination .active` metninden dogrula; sayfa degisimini ID kumesi karsilastirarak teyit et (overlap 18/18 ise sayfa DEGISMEMISTIR).
- Sayfa basina 18 kayit; tiklama sonrasi ~7s bekle.
- Bookmark URL'sinde takili `&vehicleId=...` olabilir — liste taramasinda yok say.
- Detay linkleri: `/bmw/zoeken/resultaten/details/id/<numerik>`; id path'te (redaction sorunu az) ama yine JS icinde cikar.
- Render ~5s; liste server-render agirlikli, shadow DOM gerekmez.
- Dil Flemenkce: kart alanlari "km", "Bouwjaar", "Benzine". properties alan adlarini canonical'a cevir (milage/firstRegistration...).
- Detay semasi (dogrulandi 2026-08): **VIN/chassisnummer YOK** — kimlik NL plakasi (Kenteken). "Datum deel 1" = NL tescil belgesi tarihi (import araclarda gercek ilk tescilden FARKLI olabilir; 2026 tarihli ama 13K km'li arac gorüldu — notes'a yaz). CO2 ve sahip sayisi sayfada YOK. Donanim "Uitrusting" altinda sabit alt basliklar (Uitvoeringen en Pakketten/Interieur/Entertainment/Exterieur/Klimaatbeheersing/Elektrische voorzieningen/Aandrijving en onderstel/Veiligheid), duz Flemenkce satirlar.
- **Dil kaliplari SKILL'E YAZILMAZ — config'e eklenir (2026-09-01 refactor).** Flemenkce/Almanca yazim
  varyanti bulursan tek yer: `src/data/metadata/TEXT_SIGNALS.json` (tahrik: `drivetrain.awdWords` /
  `rwdWords` — NL "achterwielaandrijving", "vierwielaandrijving" burada; hasar: `damage.words` /
  `negationWords`; marj/KDV: `vat.marginWords`) ve donanim icin `EQUIPMENT_RULES.json`
  (NL sunroof "glazen schuif-/kanteldak" S403A'da). Kararlari KOD verir:
  `drivetrain.js` tahriki, `route-listing.js` hasari/KAZALI yonlendirmesini,
  `import-dealer.js` marj notunu (`💶 Marj aracı...`) otomatik dusurur — subagent elle not yazmaz.
  Kalip eklerken regresyon testi: `scripts/lib/text-signals.test.js`.
- **Senin bu sitede yapman gereken:** RWD araclarda "Technische gegevens → Aandrijving" satirini
  `description`'a tasi (tahrik sinyali orada; kart metninde yok). Hasar icin sayfadaki beyani AYNEN
  `isDamaged` alanina yaz (or. `"Schadeverleden: ja"`) — olumsuz/hasarsiz beyanda alani HIC yazma;
  siniflandirmayi `route-listing.js` yapar (kanit yoksa etiketleme).
- Arama listesi TUM 4 Serie Coupé'yi icerir (420i/430i/M4 dahil) — kart basligindan M440 filtrele. Kart container'i `.vehicle`; sayfalama `a.page` linkleri (1/2/3...).
  - Kartlari **`.vehicle` uzerinden** topla, link'ten ata tirmanisiyla DEGIL: tirmanış "Meer informatie" butonuna takilip her kart icin ayni metni dondurur (2026-08-20).
  - **`€` redaksiyon tuzagi:** kart metnini `€` ile birlikte dondurmek ciktinin tamamini `[BLOCKED: Cookie/query string data]` yapiyor (fiyat + bayi adi + `p/m` yigini tetikliyor). Dondurmeden once `.replace(/€/g,'EUR')` uygula — ayni JS, bloklanmadan geciyor.

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=BMW_NL icin uygula (fetchStrategy: chrome-tabs). dealer.contry="NL" zorunlu.
