---
name: bayi-tara-timmermanns
description: Timmermanns (timmermanns.de, BMW/MINI bayi grubu) M440 ilanlarini tarar — bayi-tara ortak akisiyla src/data/listings/TIMMERMANNS/ altina yazim. TRIGGER - kullanici "timmermanns tara", "/bayi-tara-timmermanns" yazdiginda DOGRUDAN calistir; "bayi tara" toplu komutunun parcasidir.
---

# Timmermanns Tara

Site: **TIMMERMANNS** (config: DEALER_SITES.json → idPrefix T, pattern `[?&]i=([A-Z0-9]+)`, template var)

## Site Notlari (kesif 2026-08)

- Arama listesi server-rendered form (`car_list_filter_form` query paramlari). Detay linkleri HEP `/fahrzeugboerse/fahrzeuge` path'inde, arac kimligi `?i=` parametresinde (or. `FBUD2610518` — alfanumerik).
- **Redaction tuzagi:** query string Chrome ciktisinda gizlenir — `i` parametresini JS ICINDE `new URL(a.href).searchParams.get('i')` ile cikar.
- Ayni id birden fazla linkte (gorsel+baslik+buton) — id bazinda dedupe.
- Kart verisi: linkin atalarinda € + km iceren container (WELLER deseniyle ayni yaklasim).
- Sayfalama: form tabanli; sayfa 2+ icin sayfadaki sonraki-sayfa linkini izle, yoksa tek sayfadir. pageCap: 5.
- Detay semasi (dogrulandi 2026-08): Karosserie alani YOK, VIN YOK, mobile.de linki YOK. Donanim `<details>/<summary>` akordeonlarinda (Komfort/Sicherheit/Innenausstattung/Exterior/Multimedia/Sonderausstattung/+bazen Serienaustattung) — kapali bolumler get_page_text'te GORUNMEZ; DOM/JS veya curl+parse ile oku.
- Govde tespiti: bazi araclarda Serienausstattung'ta "Lokale Sprache ... M440i xDrive [Gran] Coupé A" satiri kesin cevap verir; yoksa ARAMA KARTINDAKI "2 Türen"/"5 Türen" alani guvenilir (4 dogrulanmis vakada birebir tuttu — detay sayfasindaki Türen/Sitze feed-default olup GUVENILMEZ).
- ID on eki (FBUD/FBUK/FBUN) sube kodu DEGIL (FBUD'li arac Nettetal'de gorulur). Exterior listesinin ilk kalemi renk olarak cift islev gorur.

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=TIMMERMANNS icin uygula (fetchStrategy: chrome-tabs).
