---
name: bayi-tara-ahg
description: ahg Gruppe (ahg-mobile.de, yetkili BMW Vertragshändler, BPS sunar) M440 ilanlarini tarar — bayi-tara ortak akisiyla src/data/listings/AHG/ altina yazim. TRIGGER - kullanici "ahg tara", "/bayi-tara-ahg" yazdiginda DOGRUDAN calistir; "bayi tara" toplu komutunun parcasidir.
---

# ahg Tara

Site: **AHG** (config: DEALER_SITES.json → idPrefix A, pattern `-(\d+)$`)

## Site Notlari (kesif 2026-08; detay semasi C692 vakasinda dogrulandi)

- **SPA, yavas render:** navigate sonrasi 8-10s bekle; get_page_text/javascript_tool 45s timeout yiyebilir — bekle-tekrar dene (2-3 deneme), sonra kullaniciya sor.
- Arama listesi: `a[href]` icinde `/^\/de\/fahrzeugsuche\/.+-\d+\/?$/` eslesenler; id `-(\d+)$` sonda. Slug'lar aciklayici (m440i-xdrive-coupe-...) ama govde icin yine attributes.Category'yi detaydan al.
- **Sayfalama:** URL `page=N` parametresi (0-tabanli). pageCap: 5.
- **Detay sayfasi ZENGIN (en degerli site):**
  - `Fahrgestellnummer` = **VIN — MUTLAKA AL** (tahrik Kural 0 + dedup icin).
  - `WLTP Emissionen ... kombiniert: 167,0` → co2Emission (mobile.de'de cogu zaman eksik olan deger burada VAR).
  - `Mwst. ausweisbar` alani → notes'a (ihracat/KDV pazarligi sinyali).
  - Donanim: `Austattungsmerkmale` (checkbox'lar → features[] Ingilizce'ye MAP ETME, description'a Almanca ekle) + `Sonderausstattung` + `Serienausstattung` — HEPSINI description'a al.
- Bayi yetkili BMW Vertragshändler — BPS olasiligi rapora not dusulebilir.

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=AHG icin uygula (fetchStrategy: chrome-tabs).
