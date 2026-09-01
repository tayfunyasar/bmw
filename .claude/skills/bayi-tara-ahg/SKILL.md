---
name: bayi-tara-ahg
description: ahg Gruppe (ahg-mobile.de, yetkili BMW Vertragshändler, BPS sunar) M440 ilanlarini tarar — bayi-tara ortak akisiyla src/data/listings/AHG/ altina yazim. TRIGGER - kullanici "ahg tara", "/bayi-tara-ahg" yazdiginda DOGRUDAN calistir; "bayi tara" toplu komutunun parcasidir.
---

# ahg Tara

Site: **AHG** (config: DEALER_SITES.json → idPrefix A, pattern `-(\d+)$`)

## Site Notlari (kesif 2026-08; detay semasi C692 vakasinda dogrulandi)

- **SPA, yavas render:** navigate sonrasi 8-10s bekle; get_page_text/javascript_tool 45s timeout yiyebilir — bekle-tekrar dene (2-3 deneme), sonra kullaniciya sor.
- Arama listesi: `a[href]` icinde `/^\/de\/fahrzeugsuche\/.+-\d+\/?$/` eslesenler; id `-(\d+)$` sonda. Slug'lar aciklayici (m440i-xdrive-coupe-...) ama govde icin yine attributes.Category'yi detaydan al.
- **Liste M440 DISI arac da icerir** (oneri kartlari): 2026-08-20'de 10 kartin 3'u M240i/M340i Touring'di. Slug'a gore `m440` filtrele, yoksa alakasiz araclar filtreye gider.
- **Kart metni formati** (dogrulandi 2026-08-20): fiyat `Angebotspreis 44.960` etiketiyle gelir (€ isareti kart metninde yok) → `/Angebotspreis\s*([\d.]+)/`; tescil `EZ 11/2022` → `/EZ (\d{2}\/\d{4})/`; km `75.137 km`. Ornek: `22BMW - M440i xDrive CoupeM440i xDrive Coupe Navi Leder ACC Glasdach Bluet75.137 kmEZ 11/2022Benzin374 PS...`
- **Sayfalama:** URL `page=N` parametresi (0-tabanli). `page=0` dolu, `page=1` BOS donuyorsa tek sayfadir — bu "render gecikmesi" degil, gercekten son sayfadir (2026-08-20: 10 kart page=0'da, page=1 sifir). pageCap: 5.
- **Detay sayfasi ZENGIN (en degerli site):**
  - `Fahrgestellnummer` = **VIN — MUTLAKA AL** (tahrik Kural 0 + dedup icin).
  - `WLTP Emissionen ... kombiniert: 167,0` → co2Emission (mobile.de'de cogu zaman eksik olan deger burada VAR).
  - `Mwst. ausweisbar` alani → notes'a (ihracat/KDV pazarligi sinyali).
  - Donanim: `Austattungsmerkmale` (checkbox'lar → features[] Ingilizce'ye MAP ETME, description'a Almanca ekle) + `Sonderausstattung` + `Serienausstattung` — HEPSINI description'a al.
- Bayi yetkili BMW Vertragshändler — BPS olasiligi rapora not dusulebilir.

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=AHG icin uygula (fetchStrategy: chrome-tabs).
