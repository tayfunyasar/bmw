---
name: bayi-tara-bmw-de
description: BMW.de resmi Gebrauchtwagen aramasi (M4_G22 filtresi, BPS dahil) — bayi-tara ortak akisiyla src/data/listings/BMW_DE/ altina yazim. Iki bookmark'i vardir (M4 G22 + M4 G22 BPS); IKISI de taranir. TRIGGER - kullanici "bmw.de tara", "bmwde tara", "/bayi-tara-bmw-de" yazdiginda DOGRUDAN calistir; "bayi tara" toplu komutunun parcasidir.
---

# BMW.de Tara

Site: **BMW_DE** (config: DEALER_SITES.json → idPrefix B, pattern `\/details\/([0-9a-f-]{36})`, template var)

## Site Notlari (kesif 2026-08)

- **Iki bookmark taranir:** "BMW.de Gebrauchtwagen — M4 G22" VE "BMW.de Gebrauchtwagen — M4 G22 BPS". Ayni site, ayni akis; dealerKey UUID oldugu icin iki aramada cikan ayni arac otomatik dedup olur.
- **SPA + YOGUN SHADOW DOM (90+ host):** duz `document.querySelectorAll` detay linki BULMAZ. Recursive shadow-root walker sart:
  ```js
  const walk=(root,d=0)=>{if(d>6)return; [...root.querySelectorAll('a[href]')].forEach(...); [...root.querySelectorAll('*')].forEach(e=>{if(e.shadowRoot)walk(e.shadowRoot,d+1)})};
  ```
- Detay URL: `/de-de/sl/gebrauchtwagen/details/<uuid36>?filters=...` — id UUID, `?filters` kismini AT.
- Render 8-13s; kartlar `[class*=card]` yapisinda ama link derinde. `page` parametresi bilinmiyor — sayfada "Mehr"/sonraki dugmesi ara; pageCap: 5.
- Not: arama "M4_G22" model ailesi — M440i ve M4 birlikte gelir; kart basligina gore M440 filtrele (M4 Competition vb. kapsam disi).
- Detay semasi (dogrulandi 2026-08): agir shadow DOM; **VIN HICBIR sayfada yok** — kimlik UUID + Angebotsnummer. Donanim S-kodlariyla tam acik liste (Fahrerassistenz/Fahrwerk/... alt basliklari); BAZI ilanlarda Ausstattung bolumu tamamen eksik (veri yok ≠ donanim yok, notes'a yaz). `schema.org` Vehicle JSON-LD var: bodyType (Category icin), EZ, sahip sayisi, interiorColor. Fahrzeugdaten blogu: Angebotsnummer/Unfallvorschaden ("Ja" ise `isDamaged` set et → KAZALI routing)/Garantietyp. Vertragspartner ile Fahrzeugstandort farkli olabilir.
- Angebotsnummer baska bayinin kendi ID'siyle birebir ayni olabilir (FBUD... = Timmermanns dealerId vakasi) — cross-site ikiz yakalamak icin notes'a yaz. BPS aramasindan gelen araclara notes'ta "BPS" isareti dus.

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=BMW_DE icin uygula (fetchStrategy: chrome-tabs, shadow-DOM walker, iki bookmark sirayla).
