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
- **Kart metni formati WELLER'dan FARKLI — WELLER regex'lerini kopyalama** (dogrulandi 2026-08-20):
  - Fiyat `51.490,00€` (kurusli, € SONDA, bosluksuz) → `/([\d.]+),\d\d€/`. WELLER'in `([\d.]{5,9})\s*€` deseni burada HIC eslesmez, sessizce bos fiyat doner.
  - Tescil `03.2023 Erstzulassung` (NOKTA ayracli, `MM/YYYY` degil) → `/(\d{2})\.(\d{4})\s*Erstzulassung/`, sonra `MM/YYYY`'ye cevir.
  - Ornek kart metni: `BMW M440 51.490,00€ MwSt. nicht ausweisbar 03.2023 Erstzulassung 28862km Laufleistung ... 4 Sitze 8 Gänge 1815kg 2 Türen`
  - `MwSt. nicht ausweisbar` = §25a marj araci → notes'a.
- Sayfalama: form tabanli; sayfa 2+ icin sayfadaki sonraki-sayfa linkini izle, yoksa tek sayfadir. pageCap: 5.
- Detay semasi (dogrulandi 2026-08): Karosserie alani YOK, VIN YOK, mobile.de linki YOK. Donanim `<details>/<summary>` akordeonlarinda (Komfort/Sicherheit/Innenausstattung/Exterior/Multimedia/Sonderausstattung/+bazen Serienaustattung) — kapali bolumler get_page_text'te GORUNMEZ; DOM/JS veya curl+parse ile oku.
- Govde tespiti: bazi araclarda Serienausstattung'ta "Lokale Sprache ... M440i xDrive [Gran] Coupé A" satiri kesin cevap verir; yoksa ARAMA KARTINDAKI "2 Türen"/"5 Türen" alani guvenilir (4 dogrulanmis vakada birebir tuttu — detay sayfasindaki Türen/Sitze feed-default olup GUVENILMEZ).
- ID on eki (FBUD/FBUK/FBUN) sube kodu DEGIL (FBUD'li arac Nettetal'de gorulur). Exterior listesinin ilk kalemi renk olarak cift islev gorur.

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=TIMMERMANNS icin uygula (fetchStrategy: chrome-tabs).
