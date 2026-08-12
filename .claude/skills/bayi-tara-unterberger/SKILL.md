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
- Sayfalama: `page=` parametresi + `itemsPerPage=9`. pageCap: 5.
- **AVUSTURYA (AT) araclari:** route/skorlama normal isler ama fiyatlar AT-KDV'li ve NoVA iadesi/ihracat kurallari DE'den farklidir — rapor notuna "AT araci" ibaresi dus.
- Slug'da "gran-coupe" gecenler GC'dir ama yine attributes.Category'yi detaydan al ("5-tuerer" slug'u da GC isaretidir).
- Detay semasi (dogrulandi 2026-08): **VIN metinde gorunmez ama `schema.org/Car` ld+json'da `vehicleIdentificationNumber` olarak VAR — MUTLAKA al**; Category de ld+json `bodyType`'tan (Karosserie alani metinde yok). Steckbrief key-value blogu: Angebotsnr/Standort/EZ/Vorbesitzer/Farbe/Polster/HU/Tueren/Sitzplaetze/HSN-TSN. WLTP/CO2 ana arac icin sayfada YOK (Energieverbrauch satirlari oneri kartlarina ait — karistirma).
- **SUBE UYARISI: Unterberger'in ALMANYA subeleri var** (Bad Wiessee 83707, Prien am Chiemsee 83209, +49) — `dealer.contry`'yi ld+json `seller.address.addressCountry`'den al, kort "AT" varsayma; Kaprun (5710, +43) gercek AT. Fiyat blogu "Barpreis / Netto: ..." — Netto'yu notes'a yaz.
- Liste sayfasinda oneri/Empfehlungen karti olarak M440-disi araclar da linklenir — slug'a gore M440i filtrele; ilk 9 (itemsPerPage=9) gercek sonuctur. Uzun slug'li kartlarda container metni kirpilir — km/EZ/fiyati ayri sorgu ile cek.

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=UNTERBERGER icin uygula (fetchStrategy: chrome-tabs).
