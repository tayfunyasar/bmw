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
  - Bazi bolumlerde collapsed `...` var — birkac kalem eksik kalabilir, notes'a yaz.
  - **Karosserie alani sayfada var; attributes.Category'ye MUTLAKA koy** — URL slug'i yalanci ("sportwagen-coupe" slug'lu Cabrio goruldu: 773891958).
  - VIN YAZMAZ (Fahrzeugnummer bayi-ici, VIN degil). `vin: null`.
  - HU / Vorbesitzer genelde yok.
  - `Differenzbesteuerung (§25a)` ibaresi varsa notes'a yaz (KDV ayristirilamaz — ihracat pazarligi etkilenir).
- Cookie banner'i icerigi bloklamiyor (pilot gozlemi).
- **API KISA YOLU (dogrulandi 2026-08-18, detay sayfasi/subagent GEREKSIZ):** site Next.js + Carfinder; detay verisi `https://api.cfdnext.com/vehicle/<id>` ile curl'den gelir (`Origin: https://wellergruppe.de` + `Referer` header'i ver; `/vehicles/...` DEGIL, tekil `/vehicle/`). Donen JSON alanlari:
  - **`categories.category` govdeyi KESIN verir** (`coupe` / `cabrio` / ...) — "new" cikan her WELLER ID'si icin detay acmadan ONCE bunu cek; slug govde soylemedigi icin Cabrio/GC'ler ancak burada yakalanir (696431305 vakasi: slug govdesiz, SPA detay sayfasi render olmuyor, API "cabrio" dedi).
  - **`meta.vin` VAR (altin)** — eski "VIN yazmaz" notu detay SAYFASI icindi; API'de VIN var, MUTLAKA al.
  - Digerleri: `purchaseOptions.price.value` + `vatReportable` (false = §25a marj, notes'a), `condition` (registrationDate/mileage/preOwner), `appearance` (renk/doseme), `environmental.wltp.co2emissions`, `features` (Ingilizce key listesi), `locations[0]` (sube adi/adres), `data` (kW/kapi/vites).
  - Donanim listesi `features`'ta Ingilizce key olarak gelir; description icin yine de detay sayfasi gerekebilir — ama govde/VIN/fiyat/durum eleme ve dedup icin API yeterli.
- **SPA detay fallback tuzagi:** bazi ilanlarin `/fahrzeuge/bmw/<slug>-<id>/` sayfasi render OLMAZ (generic arama listesine duser, "3.478 Fahrzeuge"). Bunu "ilan kayip" sanma — once API'yi dene; API 200 donuyorsa ilan yayinda demektir.

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=WELLER icin uygula (fetchStrategy: chrome-tabs, subagent'li paralel detay).
