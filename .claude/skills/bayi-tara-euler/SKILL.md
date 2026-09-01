---
name: bayi-tara-euler
description: Euler Group (euler-group.de, BMW bayi grubu) M440i ilanlarini tarar — bayi-tara ortak akisiyla src/data/listings/EULER/ altina yazim. TRIGGER - kullanici "euler tara", "/bayi-tara-euler" yazdiginda DOGRUDAN calistir; "bayi tara" toplu komutunun parcasidir.
---

# Euler Tara

Site: **EULER** (config: DEALER_SITES.json → idPrefix E, pattern `\/v\/(BM\d+)`)

## Site Notlari (kesif 2026-08)

- **SPA + SHADOW DOM:** arac listesi normal DOM'da GORUNMEZ (body ~3K karakter, liste yok). Liste `shadowRoot`lu DIV host'larin icinde. Tarama JS'i shadow-root'lara inmeli:
  ```js
  const hosts=[...document.querySelectorAll('*')].filter(e=>e.shadowRoot);
  hosts.forEach(h=>[...h.shadowRoot.querySelectorAll('a[href]')]...)
  ```
- Detay URL: `/bmw/fahrzeugsuche-gebrauchtwagen/v/BM<numerik>-<slug>` — id `BM\d+`. Template yok (slug gerekli) → tam path'i JS icinde topla.
- Render yavas: navigate sonrasi 5-10s bekle; filtreler client-side uygulaniyor, M440 disi araclar da listede olabilir — kartlari title'a gore M440 filtrele.
- Sayfalama: sonsuz kaydirma olasi — shadow host icinde scroll/`Mehr` butonu ara; pageCap: 5 tur.
- Cookie dialog metni var ("Mit diesem Button wird der Dialog geschlossen") — icerigi bloklarsa KABUL ETME, kullaniciya sor.
- **API KISA YOLU (dogrulandi 2026-08, detay sayfasi/subagent GEREKSIZ):** liste `https://signal.locarl.de/api/v3/eulergroup/listings?page=N&filter=...&customer=private&filter_locked=marke_bmw%2Cfahrzeugkategorie_pkw&finance_mode=financing&order=relevance&lang=de` API'sinden gelir; curl ile de cekilebilir (Origin/Referer header'i ver). **Bookmark URL'sindeki eski filter tokenlari ARTIK GECERSIZ** (sessizce yok sayilir, 2942 arac doner) — dogru tokenlar: `modell_bmw--m440`, `body_coupe` (`body_gran-coupe`, `body_cabrio` ayri). Token listesi API cevabinin `filters` alanindadir.
- **API cevap yapisi (dogrulandi 2026-08-20):** arac dizisi `data` alanindadir (`listings`/`items` DEGIL); sayfalama dogrudan **`meta`** objesidir — `meta.pagination` DEGIL: `j.meta = {total, current_page, per_page, has_more_pages}`. `meta.has_more_pages === false` ise sayfa cevirme.
- API item alanlari: `vehicle_nr` (BM..., dealerId), `title`, `category.name`, `registration_date` (ISO, Europe/Berlin'e cevir), `kilometre`, `price` (NET) / `price_with_tax` (BRUT — import fiyati bu), `colour`, `interior_type`, `feature_as_string` (S-kod listesi), `features_pre_rendered` (bolumlu donanim adlari — description'a ac), `emission_json`. Detay URL'si slug'siz da calisir: `/bmw/fahrzeugsuche-gebrauchtwagen/v/<vehicle_nr>/` (302 → tam slug).
  - ⚠️ **`vin` DUZELTME:** liste API'sinde `vin` artik **null geliyor** (2026-08-20'de 6/6 kayitta). Eski "vin VAR — altin" notu gecersiz — VIN'e ihtiyac varsa detay sayfasindan al, liste API'sine guvenme.
- **Kapsam uyarisi:** filter'a verdigin token seti (`modell_bmw--m440,body_coupe`) bookmark'taki km/yil limitlerini ICERMEZ; API bu limitleri uygulamadan doner. Bookmark kapsamini (≤50K km, 2021+) **yerel olarak yeniden uygula** — bkz. ortak akistaki "Kapsam kurali". 2026-08-20'de 89.535 km'lik `BMG54404801` bu yuzden "new" gorundu, import edilmedi.

## Akis

`.claude/skills/bayi-tara/SKILL.md` ortak akisini SITE=EULER icin uygula (fetchStrategy: chrome-tabs, shadow-DOM extraction).
