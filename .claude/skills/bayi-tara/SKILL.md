---
name: bayi-tara
description: Bayi sitesi crawler'larinin ORTAK akisi — tek basina tetiklenmez; bayi-tara-weller, bayi-tara-ahg gibi site skill'leri bu akisi uygular. Arama listesi Chrome'da taranir, yeni ilanlarin detay sayfalari SUBAGENT'lar ile paralel okunur (her subagent kendi sekmesi), kayitlar `npm run import:dealer` ile src/data/listings/<SITE>/ altina yazilir. TRIGGER - dogrudan tetiklenmez; kullanici "bayi tara", "tum bayileri tara" derse TUM site skill'lerini sirayla calistir.
---

# Bayi Tara — Ortak Akis

Site skill'i (`bayi-tara-<site>`) su bilgileri verir: **SITE adi** (DEALER_SITES.json anahtari), **liste cikarma JS ipuclari**, **sayfalama mekanizmasi**, **detay sayfasi notlari**. Geri kalan her adim burada — site skill'ine KOPYALANMAZ.

Config tek kaynak: `src/data/metadata/DEALER_SITES.json` (idPrefix, detailUrlIdPattern, pageCap, fetchStrategy). Arama URL'si `src/data/user_data/BOOKMARKS.json`'dan `bookmarkTitlePrefix` ile bulunur.

## Adimlar

1. **Arama URL'sini bul.** BOOKMARKS.json'da `title` alani site config'indeki `bookmarkTitlePrefix` ile baslayan kaydi oku.

2. **Arama listesini tara (ana oturum).** `mcp__claude-in-chrome__navigate` ile ac (mevcut sekme kullanilabilir), `mcp__claude-in-chrome__javascript_tool` ile kartlari topla. Site skill'indeki selector ipuclarini kullan. Her kart icin en az: `id` (site-ici, detailUrlIdPattern capture'i), `path` (detay URL yolu), `subTitle` (govde/durum sinyali icin), `price`, `reg`.
   - **Redaction notu:** Chrome cikti katmani ham URL/query string'leri "[BLOCKED]" diye gizleyebilir — ID'yi ve path'i JS ICINDE cikar, sadece onlari dondur.
   - Sayfalama: site skill'indeki mekanizmayla (buton/param) `pageCap`'e kadar; sayfada yeni kart cikmayinca dur.

3. **Existing/new ayrimi.** Toplanan kartlari stdin ile filtreye ver — id alanini SADECE mobile.de numerik id'siyse doldur; site-ici ID'ler `url` uzerinden dealerKey'e gider:
   ```bash
   echo '{"site":"<SITE>","items":[{"url":"<tam detay URL>","title":"...","subTitle":"...","price":"..."}]}' | node scripts/filter-listings.js
   ```
   `kept[].status === 'new'` olanlarin detayi acilir. `skipped` (GranCoupe/Cabrio) v1'de detaya ACILMAZ — rapor tablosunda sayilir. (Havuzun hedefi coupe; GC/Cabrio bayi kayitlari istenirse sonra acilir.)

4. **Detay sayfalarini SUBAGENT'larla paralel oku.** `new` URL'leri 3-5'erli gruplara bol; her grup icin TEK MESAJDA birden fazla `general-purpose` subagent baslat. Subagent prompt sablonu (pilotta dogrulandi):

   > You are a car-listing detail-page scraper. Chrome MCP tools may be deferred — load in ONE ToolSearch call: "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__tabs_close_mcp".
   > TASK: For EACH of these URLs: <URL listesi>. Open in a NEW Chrome tab (tabs_context_mcp once, then tabs_create_mcp for YOUR OWN tab, navigate that tabId). get_page_text; if incomplete retry once. Close YOUR tab when done. Do not touch other tabs. If a cookie/GDPR banner blocks content, do NOT accept it — report "BANNER_BLOCKED" in notes.
   > Return ONLY a JSON array, one object per URL:
   > `{ "dealerId": "<id>", "title": "...", "attributes": { "Category": "<Karosserie: Coupé | Gran Coupé | Cabrio / Roadster — sayfadaki govde alanindan>" }, "description": "<TUM donanim listesi, verbatim Almanca, newline ayrik — EN ONEMLI ALAN>", "features": [], "properties": { "milage": "...", "firstRegistration": "MM/YYYY", "upholstery": "...", "colour": "...", "manufacturerColour": "...", "co2Emission": "... g/km", "generalInspection": null, "numberOfOwners": null, "fuelType": "Petrol" }, "price": { "amount": <int> }, "dealer": { "name": "<sube>", "contry": "<DE|NL|AT>", "addesses": ["<sokak>", "<PLZ Sehir>"] }, "vin": "<Fahrgestellnummer varsa, yoksa null>", "mobileDeUrl": "<sayfada mobile.de linki varsa>", "notes": "<tuhafliklar>" }`
   > Numbers as integers. Missing field = null. Do NOT invent values.

   - **attributes.Category SART** — URL slug'i yalanci olabilir (WELLER'da "sportwagen-coupe" slug'lu Cabrio goruldu); routing bu alani okur.
   - Subagent donusunde `dealerListingUrl`'i SEN ekle (URL'ler sende — redaction'a takilmaz).

5. **Import.** Tum kayitlari birlestirip:
   ```bash
   node scripts/import-dealer.js --dry-run < kayitlar.json   # once kontrol
   node scripts/import-dealer.js < kayitlar.json             # sonra yaz
   npm run format:data
   ```
   stdin dosyasini scratchpad'e yaz (`echo` ile tek satir JSON'dan kacin — kayitlar buyuk).
   - `possibleTwins` raporunu MUTLAKA kullaniciya goster: VIN'siz mobile.de kaydinin fiziksel ikizi olabilir (W1≈C264 vakasi).
   - Dedup otomatik: mobileDeId → vin → dealerKey. Kok dosyada eslesen kayit site dosyasina YAZILMAZ (`existing` raporlanir).

6. **Rapor.** Markdown tablo: `| # | dealerKey | Durum | Baslik | Fiyat | Kategori |` — `🆕 W3 (WELLER/COUPE_GAS_WITH_SUNROOF)` / `✅ C264 (existing)` / `⚠️ possibleTwin`. Altina: kac sayfa, kac skipped (GC/Cabrio), kac subagent, banner/hata notlari.

## Toplu Mod (tum siteler — mobilede-tara adim 10 buradan cagirir)

Sira: **WELLER → TIMMERMANNS → EULER → AHG → BMW_DE → BMW_NL → UNTERBERGER** (kolay/hizlidan agir SPA'ya). Her site icin kendi `bayi-tara-<site>` skill'inin Site Notlari gecerli; akis yine bu dosya.

- **Ucuz-gecis:** once yalniz liste taramasi + filter; `new` yoksa detay/subagent ACILMAZ, siradaki siteye gec. Boylece yeni ilan olmayan turlar saniyeler surer.
- **Hata izolasyonu:** bot duvari/timeout'ta site raporlanip atlanir; kalanlar devam. Site basina en fazla 2-3 deneme.
- **Loop onay istisnasi:** otomatik dongude (mobilede-tara loop'u) possibleTwins icin onay beklenmez — import edilir, ikiz karta islenir, raporda listelenir.
- Tum sitelerin sonuclari TEK birlesik tabloda raporlanir: `| Site | Yeni | Mevcut | Ikiz | Atlanan(GC/Cabrio) | Not |`.

## Notlar

- **Eleme + existing/new + normalize + route + ID uretimi = paylasilan modullerde.** Skill'e mantik yazma; CLI'lari cagir (mobilede-tara ile ayni ilke).
- Cookie/GDPR banner: en gizlilik-dostu secenek; kabul GEREKIYORSA kullaniciya sor. 2-3 denemede gecilemiyorsa rapor et, rabbit-hole'a girme.
- Bot duvari (Cloudflare/CAPTCHA) cikarsa o siteyi raporla ve ATLA — asma girisiminde bulunma.
- Bayi Almancasi mobile.de'den farkli kaliplar kullanir (or. "Aktive Geschwindigkeitsregelung mit Stop & Go" = DAP cekirdegi). Eslesmeyen onemli donanim gorursen EQUIPMENT_RULES.json'a kalip ekle (S5AUA ornegindeki gibi) ve import'u tekrar calistir — guncelleme idempotenttir.
- Bayi sayfalarinda collapsed "..." bolumleri olabilir — subagent notlarinda gecerse rapora tasi; donanim eksik kalmis olabilir.
- VIN cogu sitede yazmaz; varsa MUTLAKA al (tahrik Kural 0 + dedup icin altin degerinde).
