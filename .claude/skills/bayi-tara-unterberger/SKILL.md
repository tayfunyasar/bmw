---
name: bayi-tara-unterberger
description: Autohaus Unterberger (at.unterberger.cc, Avusturya BMW bayisi) M440i xDrive ilanlarini tarar — bayi-tara ortak akisiyla src/data/listings/UNTERBERGER/ altina yazim. TRIGGER - kullanici "unterberger tara", "/bayi-tara-unterberger" yazdiginda DOGRUDAN calistir; "bayi tara" toplu komutunun parcasidir.
---

# Unterberger Tara

Site: **UNTERBERGER** (config: DEALER_SITES.json → idPrefix U, pattern YOK — dealerKey URL-fallback, defaultCountry AT)

## Site Notlari (kesif 2026-08)

- Bookmark URL'si hashbang (`/fahrzeugverkauf/#!/vehicles?...`) → site NORMAL query URL'sine redirect eder (`/fahrzeugboerse/?...&models=M440i+xDrive&page=&itemsPerPage=9`). Redirect sonrasi URL ile calis.
- Detay linkleri: `/fahrzeugboerse/<slug>` — numerik id YOK, slug benzersiz (or. `bmw-m440i-xdrive-coupe-pro-ahk-m-sitze-gsd-acc-360`). dealerKey = URL fallback (otomatik). Ayni arac slug degistirirse yeni kayit acilabilir — possibleTwins raporuna dikkat.
- Liste server-rendered (8.5K text, 10 M440 gecisi). Kart verisi: linkin atalarinda € + km container'i.
- **RENDER GECIKMESI — her sayfa icin navigate sonrasi 20-25s bekle.** Kartlar gec basiliyor; erken okursan sayfa "**0 Fahrzeuge**" der ve ilan HIC bulunmaz (2026-08'de 10s ve 15s beklemede birden fazla kez yasandi). "0 Fahrzeuge" gorursen bunu "ilan yok" sanma — bekleyip TEKRAR oku. Sonuc sayisi (`N Fahrzeuge`) ile bulunan kart sayisi tutmuyorsa yine bekle-tekrar dene.
- Sayfalama: `page=` parametresi + `itemsPerPage=9`. pageCap: 5.
  - Sayfa 2+ icin hashbang bookmark'a donme; redirect sonrasi olusan **duz query URL'sini kisaltarak** kullan (dogrulandi 2026-08-20):
    `https://at.unterberger.cc/fahrzeugboerse/?manufacturers=BMW&variants=122&order=Price-asc&bodyGroups=PKW&mileageMax=50000&priceMax=60000&registerDateMin=2021&usageTypes=Gebrauchtwagen&models=M440i+xDrive&modelgroups=4er&page=2&itemsPerPage=9`
    Site eksik parametreleri kendisi tamamliyor; `N Fahrzeuge` sayaci ile toplanan kart sayisini karsilastirarak dogrula (12 sonuc → 9 + 3).
  - Her sayfada 25s bekleme kurali sayfa 2 icin de gecerlidir.
- Slug bazli on-eleme: liste `a[href]`'lerinden `^/fahrzeugboerse/<slug>$` alip `m440` iceren slug'lari sec — 2026-08-20'de 29 slug'in 12'si M440'ti, gerisi oneri kartiydi. Slug'daki `gran-coupe` / `5-tuerer` / `cabrio` isaretleri filtreye `subTitle` olarak verilince GC/Cabrio detay ACILMADAN elenir (o turda 9/12 boyle elendi).
- **AVUSTURYA (AT) araclari:** route/skorlama normal isler ama fiyatlar AT-KDV'li ve NoVA iadesi/ihracat kurallari DE'den farklidir — rapor notuna "AT araci" ibaresi dus.
- Slug'da "gran-coupe" gecenler GC'dir ama yine attributes.Category'yi detaydan al ("5-tuerer" slug'u da GC isaretidir).
- Detay semasi (dogrulandi 2026-08): **VIN metinde gorunmez ama `schema.org/Car` ld+json'da `vehicleIdentificationNumber` olarak VAR — MUTLAKA al**; Category de ld+json `bodyType`'tan (Karosserie alani metinde yok). Steckbrief key-value blogu: Angebotsnr/Standort/EZ/Vorbesitzer/Farbe/Polster/HU/Tueren/Sitzplaetze/HSN-TSN. WLTP/CO2 ana arac icin sayfada YOK (Energieverbrauch satirlari oneri kartlarina ait — karistirma).
- **SUBE UYARISI: Unterberger'in ALMANYA subeleri var** (Bad Wiessee 83707, Prien am Chiemsee 83209, +49) — `dealer.contry`'yi ld+json `seller.address.addressCountry`'den al, kort "AT" varsayma; Kaprun (5710, +43) gercek AT. Fiyat blogu "Barpreis / Netto: ..." — Netto'yu notes'a yaz.
- Liste sayfasinda oneri/Empfehlungen karti olarak M440-disi araclar da linklenir — slug'a gore M440i filtrele; ilk 9 (itemsPerPage=9) gercek sonuctur. Uzun slug'li kartlarda container metni kirpilir — km/EZ/fiyati ayri sorgu ile cek.

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=UNTERBERGER icin uygula (fetchStrategy: chrome-tabs).

## Vaka notu — 2026-08-28 (C1126)

- Steckbrief'teki **ANZAHL TÜREN / ANZAHL SITZPLÄTZE** govde tipi icin en net ham kanittir: 5/5 = Gran Coupé (G26), 2/4 = Coupé (G22). Slug "gran-coupe" demese bile bu satirlari oku — `bmw-m440i-xdrive-shz-led-memory-sitze-3` slug'i govde soylemiyordu ama Steckbrief 5/5 diyordu ve mobile.de ikizi (C1126) yanlislikla COUPE havuzundaydi.
- Ayni vakada ld+json `vehicleIdentificationNumber` mobile.de kaydinin bos VIN alanini doldurdu (`WBA11AW0X0FR98053`) ve `VIN_TYPE_CODES.json`'a yeni kod (`11AW`) kazandirdi — bayi detayini acarken VIN'i almak sadece ikiz eslemesi icin degil, tip kodu tablosunu buyutmek icin de degerlidir.
