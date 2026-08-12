---
name: bayi-tara-bmw-nl
description: BMW NL Occasions (occasions.bmw.nl, resmi Hollanda BMW ikinci el — BPM odenmis LOKAL araclar) 4 Serie Coupe ilanlarini tarar — bayi-tara ortak akisiyla src/data/listings/BMW_NL/ altina yazim. TRIGGER - kullanici "bmw nl tara", "occasions tara", "/bayi-tara-bmw-nl" yazdiginda DOGRUDAN calistir; "bayi tara" toplu komutunun parcasidir.
---

# BMW NL Occasions Tara

Site: **BMW_NL** (config: DEALER_SITES.json → idPrefix N, pattern `\/details\/id\/(\d+)`, template var, defaultCountry NL)

## Site Notlari (kesif 2026-08)

- **KRITIK AYRICALIK: NL araclari — BPM ZATEN ODENMIS.** dealer.contry="NL" MUTLAKA set edilmeli; pricingCalculator NL araclarina BPM eklemez (applyBpmExemption). Toplam maliyet karsilastirmasi bu yuzden dogru cikar.
- Arama URL'sindeki `filters` parametresi base64 + PHP-serialize (icinde page/serie/chassis/fuel/datePartOne). ELLE OYNAMA — bookmark'taki hazir URL'yi ac. Sayfalama icin sayfadaki "volgende"/sonraki linkini izle (filters'i yeniden uretmeye CALISMA).
- Bookmark URL'sinde takili `&vehicleId=...` olabilir — liste taramasinda yok say.
- Detay linkleri: `/bmw/zoeken/resultaten/details/id/<numerik>`; id path'te (redaction sorunu az) ama yine JS icinde cikar.
- Render ~5s; liste server-render agirlikli, shadow DOM gerekmez.
- Dil Flemenkce: kart alanlari "km", "Bouwjaar", "Benzine". properties alan adlarini canonical'a cevir (milage/firstRegistration...).
- Detay semasi (dogrulandi 2026-08): **VIN/chassisnummer YOK** — kimlik NL plakasi (Kenteken). "Datum deel 1" = NL tescil belgesi tarihi (import araclarda gercek ilk tescilden FARKLI olabilir; 2026 tarihli ama 13K km'li arac gorüldu — notes'a yaz). CO2 ve sahip sayisi sayfada YOK. Donanim "Uitrusting" altinda sabit alt basliklar (Uitvoeringen en Pakketten/Interieur/Entertainment/Exterieur/Klimaatbeheersing/Elektrische voorzieningen/Aandrijving en onderstel/Veiligheid), duz Flemenkce satirlar.
- Flemenkce kaliplar: sunroof = "glazen schuif-/kanteldak" (EQUIPMENT_RULES S403A'ya eklendi); RWD = "achterwielaandrijving" (drivetrain.js kural 2'ye eklendi — RWD aracin Technische gegevens "Aandrijving" satirini description'a tasi); AWD = "xDrive - Vierwielaandrijving" (kural 1 yakalar). "BTW verrekenbaar: Nee" = marj araci (notes'a).
- Arama listesi TUM 4 Serie Coupé'yi icerir (420i/430i/M4 dahil) — kart basligindan M440 filtrele. Kart container'i `.vehicle`; sayfalama `a.page` linkleri (1/2/3...).

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=BMW_NL icin uygula (fetchStrategy: chrome-tabs). dealer.contry="NL" zorunlu.
